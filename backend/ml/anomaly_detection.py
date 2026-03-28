import psycopg2
import pandas as pd
import sys
from sklearn.ensemble import IsolationForest
from scipy.stats import zscore
from sklearn.preprocessing import StandardScaler

# Force stdout to UTF-8 để tránh lỗi encode
sys.stdout.reconfigure(encoding='utf-8')

DB_DIRECT_URL = "postgresql://neondb_owner:npg_alivbegXt69m@ep-bitter-mode-a1h4kt9i.ap-southeast-1.aws.neon.tech/iot_db?sslmode=require&channel_binding=require"

# ── NHẬN log_id ───────────────────────────────────────────
if len(sys.argv) < 2:
    print("No log_id provided, exiting.")
    sys.exit(0)

log_ids = [int(x) for x in sys.argv[1].split(",")]
print(f"Processing for log_ids: {log_ids}")

# ── CONNECT ───────────────────────────────────────────────
conn = psycopg2.connect(DB_DIRECT_URL)
cur = conn.cursor()

# ── LOAD DATA TRAIN (500 dòng gần nhất) ───────────────────
query = """
    SELECT log_id, zone_id, brightness_level, current_value, voltage, power_consumption, timestamp
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

# ── PREPROCESS ────────────────────────────────────────────
feature_cols = ["brightness_level", "current_value", "voltage", "power_consumption"]
df[feature_cols] = df[feature_cols].fillna(0)

scaler = StandardScaler()
features_scaled = scaler.fit_transform(df[feature_cols])
features_scaled_df = pd.DataFrame(features_scaled, index=df.index, columns=feature_cols)

z_scores_full = pd.DataFrame(zscore(features_scaled), index=df.index, columns=feature_cols)

model = IsolationForest(n_estimators=300, contamination=0.05, random_state=42)
model.fit(features_scaled)

# ── LOOP TỪNG LOG ─────────────────────────────────────────
for log_id in log_ids:
    print(f"\n--- Checking log_id: {log_id} ---")
    new_row = df[df["log_id"] == log_id]

    # 🔥 FIX: nếu không nằm trong 500 dòng → query trực tiếp
    if new_row.empty:
        print(f"log_id {log_id} not in recent 500 -> fetching from DB...")
        cur.execute("""
            SELECT log_id, zone_id, brightness_level, current_value, voltage, power_consumption, timestamp
            FROM sensor_logs WHERE log_id = %s
        """, (log_id,))
        row_db = cur.fetchone()
        if not row_db:
            print(f"log_id {log_id} not found at all, skipping.")
            continue
        new_row = pd.DataFrame([row_db], columns=df.columns)
        df = pd.concat([df, new_row], ignore_index=True)

        new_scaled = scaler.transform(new_row[feature_cols])
        features_scaled_df = pd.concat([
            features_scaled_df,
            pd.DataFrame(new_scaled, columns=feature_cols)
        ], ignore_index=True)
        new_idx = len(features_scaled_df) - 1
    else:
        new_idx = new_row.index[0]

    row = new_row.iloc[0]
    zone_id = int(row["zone_id"])
    detected_time = pd.to_datetime(row["timestamp"]).to_pydatetime()
    print(f"Zone ID: {zone_id}")

    # ── CHECK ZONE ACTIVE ────────────────────────────────
    cur.execute("SELECT status FROM zones WHERE zone_id = %s", (zone_id,))
    zone = cur.fetchone()
    if not zone:
        print(f"Zone {zone_id} not found, skipping.")
        continue

    print(f"Zone status: {zone[0]}")
    if zone[0] != "active":
        print(f"Zone {zone_id} is not active -> skip.")
        continue

    print("Zone ACTIVE -> detecting...")

    # ── RULE: LAMP FAILURE ───────────────────────────────
    if int(row["brightness_level"]) == 0 and int(row["voltage"]) == 0:
        cur.execute("""
            SELECT 1 FROM alerts WHERE zone_id=%s AND detected_time=%s AND alert_type='Lamp Failure'
        """, (zone_id, detected_time))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status)
                VALUES (%s, %s, %s, %s, %s)
            """, (zone_id, "Lamp Failure", detected_time, "high", "unresolved"))
            cur.execute("""
                UPDATE zones SET status = 'inactive' WHERE zone_id = %s AND status = 'active'
            """, (zone_id,))
            print(f"🚨 Lamp Failure -> Alert + Zone {zone_id} INACTIVE")
        continue

    # ── Z-SCORE ─────────────────────────────────────────
    z_anomaly = bool((z_scores_full.loc[new_idx].abs() > 3.5).any())

    # ── ISOLATION FOREST ────────────────────────────────
    new_scaled_input = features_scaled_df.loc[[new_idx]].values
    iso_pred = model.predict(new_scaled_input)[0]
    iso_anomaly = bool(iso_pred == -1)

    is_anomaly = z_anomaly or iso_anomaly
    print(f"Anomaly detected: {is_anomaly}")

    # ── INSERT ALERT ────────────────────────────────────
    if is_anomaly:
        cur.execute("""
            SELECT 1 FROM alerts WHERE zone_id=%s AND detected_time=%s AND alert_type='Energy Anomaly'
        """, (zone_id, detected_time))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO alerts (zone_id, alert_type, detected_time, severity, status)
                VALUES (%s, %s, %s, %s, %s)
            """, (zone_id, "Energy Anomaly", detected_time, "medium", "unresolved"))
            cur.execute("""
                UPDATE zones SET status = 'inactive' WHERE zone_id = %s AND status = 'active'
            """, (zone_id,))
            print(f"⚠️ Energy Anomaly -> Alert + Zone {zone_id} INACTIVE")
        else:
            print("Alert already exists.")
    else:
        print("No anomaly detected.")

# ── COMMIT ───────────────────────────────────────────────
conn.commit()
conn.close()
print("\n✅ Done.")