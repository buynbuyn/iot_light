import psycopg2
import pandas as pd
import sys
from sklearn.ensemble import IsolationForest
from scipy.stats import zscore
from sklearn.preprocessing import StandardScaler

DB_URL = "postgresql://neondb_owner:npg_alivbegXt69m@ep-bitter-mode-a1h4kt9i-pooler.ap-southeast-1.aws.neon.tech/iot_db?sslmode=require&channel_binding=require"

# ── NHẬN log_id từ argument (do Node.js truyền vào) ──────────────────────────
if len(sys.argv) < 2:
    print("No log_id provided, exiting.")
    sys.exit(0)

new_log_id = int(sys.argv[1])
print(f"Processing for log_id: {new_log_id}")

# ── CONNECT ───────────────────────────────────────────────────────────────────
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# ── LOAD 500 DÒNG GẦN NHẤT (để train model) ──────────────────────────────────
query = """
    SELECT log_id, zone_id, brightness_level, current_value, voltage,
           power_consumption, timestamp
    FROM sensor_logs
    ORDER BY timestamp DESC
    LIMIT 500
"""
df = pd.read_sql(query, conn)
print(f"Loaded rows: {len(df)}")

if df.empty:
    print("No data, exiting.")
    conn.close()
    sys.exit(0)

# ── LẤY DÒNG MỚI NHẤT VỪA GỬI TỚI ───────────────────────────────────────────
new_row = df[df["log_id"] == new_log_id]
if new_row.empty:
    print(f"log_id {new_log_id} not found in recent data, exiting.")
    conn.close()
    sys.exit(0)

# ── TIỀN XỬ LÝ ───────────────────────────────────────────────────────────────
feature_cols = ["brightness_level", "current_value", "voltage", "power_consumption"]

df[feature_cols] = df[feature_cols].fillna(0)

scaler = StandardScaler()
features_scaled = scaler.fit_transform(df[feature_cols])
features_scaled_df = pd.DataFrame(features_scaled, index=df.index, columns=feature_cols)

# ── RULE-BASED: ĐÈN KHÔNG HOẠT ĐỘNG ─────────────────────────────────────────
row = new_row.iloc[0]
if row["brightness_level"] == 0 and row["voltage"] == 0:
    cur.execute("""
        SELECT 1 FROM alerts
        WHERE zone_id=%s AND detected_time=%s AND alert_type='Lamp Failure'
    """, (row["zone_id"], row["timestamp"]))
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (int(row["zone_id"]), "Lamp Failure", row["timestamp"], "high", "unresolved"))
        print("Lamp Failure alert inserted.")

# ── Z-SCORE: chỉ kiểm tra dòng mới ──────────────────────────────────────────
new_idx = new_row.index[0]
new_row_scaled = features_scaled_df.loc[new_idx]

# Z-score tính trên toàn bộ tập để chuẩn hóa phân phối
z_scores_full = pd.DataFrame(zscore(features_scaled), index=df.index, columns=feature_cols)
z_anomaly = (z_scores_full.loc[new_idx].abs() > 2.5).any()
print(f"Z-score anomaly: {z_anomaly}")

# ── ISOLATION FOREST: train trên toàn bộ, predict dòng mới ──────────────────
model = IsolationForest(n_estimators=300, contamination=0.1, random_state=42)
model.fit(features_scaled)

new_scaled_input = features_scaled_df.loc[[new_idx]]
iso_pred = model.predict(new_scaled_input)[0]
iso_anomaly = (iso_pred == -1)
print(f"Isolation Forest anomaly: {iso_anomaly}")

# ── GỘP KẾT QUẢ 2 THUẬT TOÁN ─────────────────────────────────────────────────
is_anomaly = z_anomaly or iso_anomaly
print(f"Final anomaly decision: {is_anomaly}")

# ── LƯU ALERT NẾU CÓ BẤT THƯỜNG ─────────────────────────────────────────────
if is_anomaly:
    cur.execute("""
        SELECT 1 FROM alerts
        WHERE zone_id=%s AND detected_time=%s AND alert_type='Energy Anomaly'
    """, (row["zone_id"], row["timestamp"]))
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (int(row["zone_id"]), "Energy Anomaly", row["timestamp"], "medium", "unresolved"))
        print("Energy Anomaly alert inserted.")
    else:
        print("Alert already exists, skipping.")
else:
    print("No anomaly detected, nothing saved.")

# ── COMMIT & CLOSE ────────────────────────────────────────────────────────────
conn.commit()
conn.close()
print("Done.")