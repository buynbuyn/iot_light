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
        requests.post(url, data=data)
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

if len(sys.argv) < 2:
    sys.exit(0)

log_ids = [int(x) for x in sys.argv[1].split(",")]

conn = psycopg2.connect(DB_DIRECT_URL)
cur = conn.cursor()

feature_cols = ["current_value", "brightness_level", "voltage", "power_consumption"]

# ================= MAIN LOOP =================
for log_id in log_ids:
    cur.execute("""
        SELECT log_id, zone_id, brightness_level, current_value, voltage, power_consumption, timestamp
        FROM sensor_logs WHERE log_id = %s
    """, (log_id,))

    row = cur.fetchone()
    if not row:
        continue

    zone_id = row[1]
    detected_time = row[6]

    df_new = pd.DataFrame([[row[3], row[2], row[4], row[5]]], columns=feature_cols).fillna(0)


    # ===== CHECK ZONE ACTIVE =====
    cur.execute("SELECT status FROM zones WHERE zone_id = %s", (zone_id,))
    zone_status = cur.fetchone()
    if not zone_status or zone_status[0] != 'active':
        continue

    # ================= RULE 1: LAMP FAILURE =================
    if int(row[3]) == 0 and int(row[4]) == 0:

        print(f"Lamp Failure at Zone {zone_id}")

        cur.execute("""
            INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (zone_id, "Lamp Failure", detected_time, "high", "unresolved"))

        cur.execute("UPDATE zones SET status = 'inactive' WHERE zone_id = %s", (zone_id,))

        # 🔥 TELEGRAM
        send_telegram(
            f"LAMP FAILURE\nZone: {zone_id}\nTime: {detected_time}"
        )

        continue

    # ================= AI DETECTION =================
    new_scaled = scaler.transform(df_new)

    iso_anomaly = (model.predict(new_scaled)[0] == -1)

    z_scores = np.abs(new_scaled)
    z_anomaly = (z_scores > 2).any()

    if iso_anomaly or z_anomaly:
        print(f"Anomaly Detected for Log {log_id}")

        cur.execute("""
            INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (zone_id, "Energy Anomaly", detected_time, "medium", "unresolved"))

        cur.execute("UPDATE zones SET status = 'inactive' WHERE zone_id = %s", (zone_id,))

        # 🔥 TELEGRAM
        send_telegram(
            f"ENERGY ANOMALY\nZone: {zone_id}\nTime: {detected_time}"
        )

    else:
        print(f"Log {log_id} is Normal")

# ================= COMMIT =================
conn.commit()
conn.close()