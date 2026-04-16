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
model = joblib.load(os.path.join(BASE_DIR, "models", "anomaly_model.pkl"))
scaler = joblib.load(os.path.join(BASE_DIR, "models", "scaler.pkl"))
print("Model loaded OK")

# ================= DB CONFIG =================
DB_DIRECT_URL = "postgresql://neondb_owner:npg_alivbegXt69m@ep-bitter-mode-a1h4kt9i.ap-southeast-1.aws.neon.tech/iot_db?sslmode=require"

if len(sys.argv) < 2:
    sys.exit(0)

log_ids = [int(x) for x in sys.argv[1].split(",")]

conn = psycopg2.connect(DB_DIRECT_URL)
cur = conn.cursor()

# ================= FEATURE SET FOR AI (PHẢI GIỐNG TRAIN) =================
feature_cols = ["current_value", "brightness_level", "power_consumption"]

# ================= MAIN LOOP =================
for log_id in log_ids:
    cur.execute("""
        SELECT log_id, zone_id,
               current_value, brightness_level, voltage, power_consumption,
               timestamp
        FROM sensor_logs
        WHERE log_id = %s
    """, (log_id,))
    row = cur.fetchone()
    if not row:
        continue

    log_id, zone_id, current_value, brightness, voltage, power, timestamp = row

    # ===== CHECK ZONE ACTIVE =====
    cur.execute("SELECT status FROM zones WHERE zone_id = %s", (zone_id,))
    zone_status = cur.fetchone()
    if not zone_status or zone_status[0] != "active":
        continue

    # ================= RULE BASE =================
    if voltage == 0:
        print(f"Zone {zone_id}: Power off")
        continue

    if current_value == 0 and brightness == 0 and voltage > 0:
        print(f"Zone {zone_id}: Lamp Failure")
        cur.execute("""
            INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (zone_id, "Lamp Failure", timestamp, "high", "unresolved"))
        cur.execute("UPDATE zones SET status = 'inactive' WHERE zone_id = %s", (zone_id,))
        send_telegram(f"LAMP FAILURE\nZone {zone_id}\nTime {timestamp}")
        conn.commit()
        continue

    # ================= AI DETECTION =================
    df_new = pd.DataFrame([[current_value, brightness, power]], columns=feature_cols).fillna(0)
    scaled = scaler.transform(df_new)

    iso_anomaly = (model.predict(scaled)[0] == -1)
    z_score = np.abs(scaled)
    z_anomaly = (z_score > 4).any()

    if iso_anomaly or z_anomaly:
        print(f"Zone {zone_id}: Energy Anomaly")
        cur.execute("""
            INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (zone_id, "Energy Anomaly", timestamp, "medium", "unresolved"))
        cur.execute("UPDATE zones SET status = 'inactive' WHERE zone_id = %s", (zone_id,))
        send_telegram(f"ENERGY ANOMALY\nZone {zone_id}\nTime {timestamp}")
    else:
        print(f"Zone {zone_id}: Normal")
        # Nếu muốn zone trở lại active khi bình thường:
        cur.execute("UPDATE zones SET status = 'active' WHERE zone_id = %s", (zone_id,))

    conn.commit()
conn.close()