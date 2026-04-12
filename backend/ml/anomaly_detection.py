import psycopg2
import pandas as pd
import sys
import os
import sys
import joblib
import joblib
import numpy as np

# Load model đã train
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load model: Kết hợp BASE_DIR với folder models
try:
    # Nếu folder models nằm TRONG thư mục ml, dùng đường dẫn này:
    model_path = os.path.join(BASE_DIR, "models", "anomaly_model.pkl")
    scaler_path = os.path.join(BASE_DIR, "models", "scaler.pkl") 
    
    # Kiểm tra xem file có tồn tại thật không trước khi load
    if not os.path.exists(model_path) or not os.path.exists(scaler_path):
        raise FileNotFoundError(f"Không tìm thấy file tại: {model_path} hoặc {scaler_path}")

    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    print(" Models loaded successfully!")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)

DB_DIRECT_URL = "postgresql://neondb_owner:npg_alivbegXt69m@ep-bitter-mode-a1h4kt9i.ap-southeast-1.aws.neon.tech/iot_db?sslmode=require"

if len(sys.argv) < 2:
    sys.exit(0)

log_ids = [int(x) for x in sys.argv[1].split(",")]
conn = psycopg2.connect(DB_DIRECT_URL)
cur = conn.cursor()

feature_cols = ["brightness_level", "current_value", "voltage", "power_consumption"]

for log_id in log_ids:
    cur.execute("SELECT log_id, zone_id, brightness_level, current_value, voltage, power_consumption, timestamp FROM sensor_logs WHERE log_id = %s", (log_id,))
    row_db = cur.fetchone()
    if not row_db: continue

    # Chuyển dữ liệu sang DataFrame
    df_new = pd.DataFrame([row_db[2:6]], columns=feature_cols).fillna(0)
    zone_id = row_db[1]
    detected_time = row_db[6]

    # --- KIỂM TRA TRẠNG THÁI ZONE ---
    cur.execute("SELECT status FROM zones WHERE zone_id = %s", (zone_id,))
    zone_status = cur.fetchone()
    if not zone_status or zone_status[0] != 'active': continue

    # --- 1. RULE CỨNG: Lamp Failure ---
    if int(row_db[2]) == 0 and int(row_db[4]) == 0:
        # (Logic Insert Alert Lamp Failure giữ nguyên như code cũ của bạn)
        cur.execute("INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status) VALUES (%s, %s, %s, %s, %s)", 
                   (zone_id, "Lamp Failure", detected_time, "high", "unresolved"))
        cur.execute("UPDATE zones SET status = 'inactive' WHERE zone_id = %s", (zone_id,))
        continue

    # --- 2. DÙNG MODEL ĐÃ TRAIN (Isolation Forest & Z-Score) ---
    new_scaled = scaler.transform(df_new)

    # Isolation Forest Prediction
    iso_anomaly = (model.predict(new_scaled)[0] == -1)

    # Z-Score Manual (Dùng scaler để tính nhanh thay vì gọi thư viện scipy)
    # Scaler lưu mean và scale (std), z = (x - mean) / std
    z_scores = np.abs(new_scaled) 
    z_anomaly = (z_scores > 1.5).any() # Ngưỡng 

    if iso_anomaly or z_anomaly:
        print(f"Anomaly Detected for Log {log_id}")
        cur.execute("INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status) VALUES (%s, %s, %s, %s, %s)", 
                   (zone_id, "Energy Anomaly", detected_time, "medium", "unresolved"))
        cur.execute("UPDATE zones SET status = 'inactive' WHERE zone_id = %s", (zone_id,))
    else:
        print(f"Log {log_id} is Normal")

conn.commit()
conn.close()