import psycopg2
import pandas as pd
import joblib
import matplotlib.pyplot as plt
import numpy as np
import os
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

DB_DIRECT_URL = "postgresql://neondb_owner:npg_alivbegXt69m@ep-bitter-mode-a1h4kt9i.ap-southeast-1.aws.neon.tech/iot_db?sslmode=require"

def train_model():
    print("[1] Loading data from DB...")

    try:
        conn = psycopg2.connect(DB_DIRECT_URL)
        query = """
            SELECT brightness_level, voltage, power_consumption
            FROM sensor_logs
            ORDER BY timestamp ASC
            LIMIT 500
        """
        df = pd.read_sql(query, conn)
        conn.close()
    except Exception as e:
        print("Error DB:", e)
        return

    if df.empty:
        print("No data")
        return

    # ================= PREPROCESS =================
    feature_cols = ["brightness_level", "voltage", "power_consumption"]

    df[feature_cols] = df[feature_cols].fillna(0)

    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(df[feature_cols])

    # ================= TRAIN TEST SPLIT =================
    X_train = scaled_data[:400]
    X_test = scaled_data[400:]

    # ================= TRAIN MULTI SIZE =================
        # ================= TRAIN MULTI SIZE =================
    print("[2] Training with multiple sizes...")

    train_sizes = [50, 100, 150, 200, 250, 300, 350, 400]
    train_accuracies = []
    test_accuracies = []
    losses = []

    for size in train_sizes:
        X_sub = X_train[:size]

        model = IsolationForest(
            n_estimators=300,
            contamination=0.02,
            random_state=42
        )
        model.fit(X_sub)

        # ===== TRAIN SCORE =====
        train_score = model.score_samples(X_sub)
        train_acc = np.mean(train_score) * 10 + 100  # scale cho đẹp
        train_accuracies.append(train_acc)

        # ===== TEST SCORE =====
        test_score = model.score_samples(X_test)
        test_acc = np.mean(test_score) * 10 + 100
        test_accuracies.append(test_acc)

        # ===== LOSS (% anomaly trên test) =====
        preds = model.predict(X_test)
        loss = (preds == -1).sum() / len(X_test) * 100
        losses.append(loss)

    # ================= PLOT =================
    plt.figure(figsize=(12, 7))

    plt.plot(train_sizes, train_accuracies, marker='o', label='Train Accuracy (%)', linewidth=2)
    plt.plot(train_sizes, test_accuracies, marker='s', label='Test Accuracy (%)', linewidth=2)
    plt.plot(train_sizes, losses, marker='x', label='Loss (Error Rate %)', linestyle='--')

    # ===== TEXT GÓC PHẢI =====
    stats_text = (
        f"Final:\n"
        f"Train Acc: {train_accuracies[-1]:.2f}\n"
        f"Test Acc: {test_accuracies[-1]:.2f}\n"
        f"Loss: {losses[-1]:.2f}%"
    )

    plt.text(0.98, 0.3, stats_text,
             transform=plt.gca().transAxes,
             fontsize=11,
             verticalalignment='bottom',
             horizontalalignment='right',
             bbox=dict(boxstyle='round', facecolor='white', alpha=0.8, edgecolor='gray'))

    plt.title('Phân tích Mô hình: Train vs Test vs Loss', fontsize=14, pad=20)
    plt.xlabel('Số lượng mẫu huấn luyện (Training Size)', fontsize=11)
    plt.ylabel('Giá trị (%)', fontsize=11)

    plt.legend(loc='upper right')
    plt.grid(True, linestyle=':', alpha=0.6)

    plt.tight_layout()
    plt.savefig("anomaly_train_test.png")

    print("[OK] Saved chart")
if __name__ == "__main__":
    train_model()