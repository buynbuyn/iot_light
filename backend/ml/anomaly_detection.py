import psycopg2
import pandas as pd
import sys
import os
import joblib
import numpy as np
import requests

# ================= TELEGRAM CONFIG =================
BOT_TOKEN = "8778153970:AAEYNL78RkMRDv0nBegde8K2mkOiMkLYv5M"
CHAT_ID = "8039711385"

def send_telegram(msg):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    data = {
        "chat_id": CHAT_ID,
        "text": msg
    }
    try:
        requests.post(url, data=data, timeout=10)
    except Exception as e:
        print("Send Telegram failed:", e)

# ================= LOAD MODEL =================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

try:
    model_path = os.path.join(BASE_DIR, "models", "anomaly_model.pkl")
    scaler_path = os.path.join(BASE_DIR, "models", "scaler.pkl")

    if not os.path.exists(model_path) or not os.path.exists(scaler_path):
        raise FileNotFoundError("Model or Scaler not found")

    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    print("Models loaded successfully!")

except Exception as e:
    print(f"Error loading model: {e}")
    sys.exit(1)

# ================= DB CONFIG =================
DB_DIRECT_URL = "postgresql://neondb_owner:npg_alivbegXt69m@ep-bitter-mode-a1h4kt9i.ap-southeast-1.aws.neon.tech/iot_db?sslmode=require"

# ================= THRESHOLDS =================
# Có thể chỉnh lại theo thực tế cảm biến của bạn
BRIGHTNESS_ON_THRESHOLD = 1.0
CURRENT_MIN_THRESHOLD = 0.01
POWER_MIN_THRESHOLD = 0.05

if len(sys.argv) < 2:
    sys.exit(0)

log_ids = [int(x) for x in sys.argv[1].split(",")]

conn = psycopg2.connect(DB_DIRECT_URL)
cur = conn.cursor()

# Thêm current_value vào feature_cols để khớp với file train model
feature_cols = ["current_value", "brightness_level", "voltage", "power_consumption"]

def has_unresolved_alert(zone_id, alert_type):
    cur.execute("""
        SELECT 1
        FROM alerts
        WHERE zone_id = %s
          AND alert_type = %s
          AND status = 'unresolved'
        LIMIT 1
    """, (zone_id, alert_type))
    return cur.fetchone() is not None

# ================= MAIN LOOP =================
for log_id in log_ids:
    cur.execute("""
        SELECT log_id, zone_id, brightness_level, current_value, voltage, power_consumption, timestamp
        FROM sensor_logs
        WHERE log_id = %s
    """, (log_id,))

    row = cur.fetchone()
    if not row:
        print(f"Log {log_id} not found")
        continue

    # row index:
    # 0 = log_id
    # 1 = zone_id
    # 2 = brightness_level
    # 3 = current_value
    # 4 = voltage
    # 5 = power_consumption
    # 6 = timestamp

    zone_id = row[1]
    brightness_level = float(row[2] or 0)
    current_value = float(row[3] or 0)
    voltage = float(row[4] or 0)
    power_consumption = float(row[5] or 0)
    detected_time = row[6]

    df_new = pd.DataFrame([[
        current_value,
        brightness_level,
        voltage,
        power_consumption
    ]], columns=feature_cols).fillna(0)

    # ===== CHECK ZONE ACTIVE =====
    cur.execute("SELECT status FROM zones WHERE zone_id = %s", (zone_id,))
    zone_status = cur.fetchone()
    if not zone_status or zone_status[0] != 'active':
        print(f"Zone {zone_id} is not active, skip")
        continue

    # ================= RULE 1: LAMP FAILURE =================
    # Logic mới:
    # Nếu hệ thống đang set brightness > 0 tức là đèn đáng lẽ phải bật,
    # nhưng current_value và power_consumption gần 0 => nghi đèn hư / không sáng
    lamp_should_be_on = brightness_level > BRIGHTNESS_ON_THRESHOLD
    no_current = current_value <= CURRENT_MIN_THRESHOLD
    no_power = power_consumption <= POWER_MIN_THRESHOLD

    if lamp_should_be_on and no_current and no_power:
        print(f"Lamp Failure at Zone {zone_id}")

        if not has_unresolved_alert(zone_id, "Lamp Failure"):
            cur.execute("""
                INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status)
                VALUES (%s, %s, %s, %s, %s)
            """, (zone_id, "Lamp Failure", detected_time, "high", "unresolved"))

            cur.execute("""
                UPDATE zones
                SET status = 'inactive'
                WHERE zone_id = %s
            """, (zone_id,))

            send_telegram(
                f"LAMP FAILURE\n"
                f"Zone: {zone_id}\n"
                f"Time: {detected_time}\n"
                f"Brightness: {brightness_level}\n"
                f"Current: {current_value}\n"
                f"Voltage: {voltage}\n"
                f"Power: {power_consumption}"
            )
        else:
            print(f"Unresolved Lamp Failure already exists for Zone {zone_id}")

        continue

    # ================= AI DETECTION =================
    try:
        new_scaled = scaler.transform(df_new)
        iso_anomaly = (model.predict(new_scaled)[0] == -1)

        z_scores = np.abs(new_scaled)
        z_anomaly = (z_scores > 2.5).any()

        if iso_anomaly or z_anomaly:
            print(f"Anomaly Detected for Log {log_id}")

            if not has_unresolved_alert(zone_id, "Energy Anomaly"):
                cur.execute("""
                    INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status)
                    VALUES (%s, %s, %s, %s, %s)
                """, (zone_id, "Energy Anomaly", detected_time, "medium", "unresolved"))

                cur.execute("""
                    UPDATE zones
                    SET status = 'inactive'
                    WHERE zone_id = %s
                """, (zone_id,))

                send_telegram(
                    f"ENERGY ANOMALY\n"
                    f"Zone: {zone_id}\n"
                    f"Time: {detected_time}\n"
                    f"Brightness: {brightness_level}\n"
                    f"Current: {current_value}\n"
                    f"Voltage: {voltage}\n"
                    f"Power: {power_consumption}"
                )
            else:
                print(f"Unresolved Energy Anomaly already exists for Zone {zone_id}")

        else:
            print(f"Log {log_id} is Normal")

    except Exception as e:
        print(f"Error detecting anomaly for log {log_id}: {e}")

# ================= COMMIT =================
conn.commit()
cur.close()
conn.close()
print("Done")