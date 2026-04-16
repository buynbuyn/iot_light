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

# ================= DB =================
DB_DIRECT_URL = "postgresql://neondb_owner:npg_alivbegXt69m@ep-bitter-mode-a1h4kt9i.ap-southeast-1.aws.neon.tech/iot_db?sslmode=require"

if len(sys.argv) < 2:
    sys.exit(0)

log_ids = [int(x) for x in sys.argv[1].split(",")]

conn = psycopg2.connect(DB_DIRECT_URL)
cur = conn.cursor()

# ================= FEATURE CONSISTENCY (QUAN TRỌNG NHẤT) =================
feature_cols = ["current_value", "brightness_level", "voltage", "power_consumption"]

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

    # ================= RULE =================
    if brightness == 0 and voltage == 0:
        print("Lamp failure")

        cur.execute("""
            INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (zone_id, "Lamp Failure", timestamp, "high", "unresolved"))

        send_telegram(f"LAMP FAILURE\nZone {zone_id}")

        continue

    # ================= AI INPUT =================
    df_new = pd.DataFrame([[
        current_value,
        brightness,
        voltage,
        power
    ]], columns=feature_cols).fillna(0)

    scaled = scaler.transform(df_new)

    iso_anomaly = (model.predict(scaled)[0] == -1)

    z_score = np.abs(scaled)
    z_anomaly = (z_score > 3.5).any()

    if iso_anomaly or z_anomaly:
        print("ANOMALY")

        cur.execute("""
            INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (zone_id, "Energy Anomaly", timestamp, "medium", "unresolved"))

        send_telegram(f"ENERGY ANOMALY\nZone {zone_id}")

    else:
        print("NORMAL")

conn.commit()
conn.close()