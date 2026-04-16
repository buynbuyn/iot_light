import psycopg2
import pandas as pd
import joblib
import numpy as np
import os
import matplotlib.pyplot as plt
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

DB_DIRECT_URL = "postgresql://neondb_owner:npg_alivbegXt69m@ep-bitter-mode-a1h4kt9i.ap-southeast-1.aws.neon.tech/iot_db?sslmode=require"

MODEL_DIR = "models"
os.makedirs(MODEL_DIR, exist_ok=True)

def train_model():
    conn = psycopg2.connect(DB_DIRECT_URL)
    query = """
        SELECT current_value, brightness_level, power_consumption
        FROM sensor_logs
        ORDER BY timestamp ASC
        LIMIT 1000
    """
    df = pd.read_sql(query, conn)
    conn.close()

    if df.empty:
        print("No data")
        return

    feature_cols = ["current_value", "brightness_level", "power_consumption"]
    df = df[feature_cols].fillna(0)

    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(df)

    # Chia train/test cố định
    X_train, X_test = train_test_split(scaled_data, test_size=0.3, random_state=42)

    train_sizes = [50, 100, 200, 400, 600]  # số lượng mẫu huấn luyện
    train_accs, test_accs, losses = [], [], []

    for size in train_sizes:
        X_sub = X_train[:size]
        model = IsolationForest(n_estimators=300, contamination=0.02, random_state=42)
        model.fit(X_sub)

        train_preds = model.predict(X_sub)
        test_preds = model.predict(X_test)

        train_accs.append((train_preds == 1).mean() * 100)
        test_accs.append((test_preds == 1).mean() * 100)
        losses.append((test_preds == -1).mean() * 100)

    # Vẽ biểu đồ
    plt.figure(figsize=(10,6))
    plt.plot(train_sizes, train_accs, 'o-', color='blue', label='Train Accuracy (%)')
    plt.plot(train_sizes, test_accs, 'o-', color='orange', label='Test Accuracy (%)')
    plt.plot(train_sizes, losses, 'x--', color='green', label='Loss (Error Rate %)')

    plt.xlabel("Số lượng mẫu huấn luyện (Training Size)")
    plt.ylabel("Giá trị (%)")
    plt.title("Phân tích Mô hình: Train vs Test vs Loss")
    plt.legend(loc="best")

    # Hiển thị giá trị cuối cùng
    final_text = f"Final:\nTrain Acc: {train_accs[-1]:.2f}\nTest Acc: {test_accs[-1]:.2f}\nLoss: {losses[-1]:.2f}%"
    plt.text(train_sizes[-1]+20, max(train_accs+test_accs+losses)-5, final_text, fontsize=10)

    plt.tight_layout()
    plt.savefig(os.path.join(MODEL_DIR, "analysis_chart.png"))
    plt.close()

    print("[OK] Chart saved to models/analysis_chart.png")

if __name__ == "__main__":
    train_model()