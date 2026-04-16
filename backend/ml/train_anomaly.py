import psycopg2
import pandas as pd
import joblib
import numpy as np
import os
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

DB_DIRECT_URL = "postgresql://neondb_owner:npg_alivbegXt69m@ep-bitter-mode-a1h4kt9i.ap-southeast-1.aws.neon.tech/iot_db?sslmode=require"

MODEL_DIR = "models"
os.makedirs(MODEL_DIR, exist_ok=True)

def train_model():
    print("[1] Loading data from DB...")
    try:
        conn = psycopg2.connect(DB_DIRECT_URL)
        query = """
            SELECT current_value, brightness_level, power_consumption
            FROM sensor_logs
            ORDER BY timestamp ASC
            LIMIT 1000
        """
        df = pd.read_sql(query, conn)
        conn.close()
    except Exception as e:
        print("Error DB:", e)
        return

    if df.empty:
        print("No data")
        return

    # ================= FEATURE SET =================
    feature_cols = ["current_value", "brightness_level", "power_consumption"]
    df = df[feature_cols].fillna(0)

    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(df)

    # ================= SPLIT =================
    X_train, X_test = train_test_split(scaled_data, test_size=0.3, random_state=42)

    print("[2] Training...")
    model = IsolationForest(n_estimators=300, contamination=0.02, random_state=42)

    model.fit(X_train)

    # ================= EVALUATION =================
    train_preds = model.predict(X_train)
    test_preds = model.predict(X_test)

    train_acc = (train_preds == 1).mean() * 100
    test_acc = (test_preds == 1).mean() * 100
    loss = (test_preds == -1).mean() * 100

    print(f"Train Acc: {train_acc:.2f}%")
    print(f"Test Acc: {test_acc:.2f}%")
    print(f"Loss: {loss:.2f}%")

    # ================= SAVE MODEL =================
    joblib.dump(model, os.path.join(MODEL_DIR, "anomaly_model.pkl"))
    joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.pkl"))
    print("[OK] Model + Scaler saved")

if __name__ == "__main__":
    train_model()
