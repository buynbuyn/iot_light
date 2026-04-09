import psycopg2
import pandas as pd
import joblib
import matplotlib.pyplot as plt
import numpy as np
import os
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# Cấu hình kết nối
DB_DIRECT_URL = "postgresql://neondb_owner:npg_alivbegXt69m@ep-bitter-mode-a1h4kt9i.ap-southeast-1.aws.neon.tech/iot_db?sslmode=require"

def train_model():
    print("🔄 1. Đang kết nối DB và lấy dữ liệu...")
    try:
        conn = psycopg2.connect(DB_DIRECT_URL)
        query = "SELECT brightness_level, current_value, voltage, power_consumption, timestamp FROM sensor_logs ORDER BY timestamp ASC LIMIT 500"
        df = pd.read_sql(query, conn)
        conn.close()
    except Exception as e:
        print(f"❌ Lỗi kết nối DB: {e}")
        return

    if df.empty:
        print("❌ Không có dữ liệu.")
        return

    feature_cols = ["brightness_level", "current_value", "voltage", "power_consumption"]
    df[feature_cols] = df[feature_cols].fillna(0)
    
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(df[feature_cols])

    # --- PHẦN TÍNH TOÁN CHO BIỂU ĐỒ ĐƯỜNG ---
    print("📈 2. Đang phân tích Train, Test Accuracy và Loss...")
    train_sizes = [50, 100, 150, 200, 250, 300, 350, 400]
    train_accuracies = []
    test_accuracies = []
    losses = [] 
    
    X_final_test = scaled_data[400:] 

    for size in train_sizes:
        X_sub_train = scaled_data[:size]
        model_temp = IsolationForest(n_estimators=300, contamination=0.01, random_state=42)
        model_temp.fit(X_sub_train)
        
        train_preds = model_temp.predict(X_sub_train)
        t_acc = (train_preds == 1).sum() / len(X_sub_train) * 100
        train_accuracies.append(t_acc)
        
        test_preds = model_temp.predict(X_final_test)
        v_acc = (test_preds == 1).sum() / len(X_final_test) * 100
        test_accuracies.append(v_acc)
        
        loss = (test_preds == -1).sum() / len(X_final_test) * 100
        losses.append(loss)

    # --- VẼ BIỂU ĐỒ ---
    plt.figure(figsize=(12, 7))
    
    plt.plot(train_sizes, train_accuracies, marker='o', label='Train Accuracy (%)', color='green', linewidth=2)
    plt.plot(train_sizes, test_accuracies, marker='s', label='Test Accuracy (%)', color='blue', linewidth=2)
    plt.plot(train_sizes, losses, marker='x', label='Loss (Error Rate %)', color='red', linestyle='--')
    
    # --- CHÈN THÔNG SỐ 3 HÀNG Ở GÓC PHẢI ---
    # Sử dụng transform=plt.gca().transAxes để tọa độ (0,0) -> (1,1) là toàn bộ khung biểu đồ
    stats_text = (
        f"📊 Đánh giá cuối cùng:\n"
        f"● Train Acc: {train_accuracies[-1]:.2f}%\n"
        f"● Test Acc: {test_accuracies[-1]:.2f}%\n"
        f"● Loss: {losses[-1]:.2f}%"
    )
    
    # Đặt ở tọa độ x=0.98 (sát phải), y=0.3 (hơi thấp xuống để không đè lên Legend chính)
    plt.text(0.98, 0.3, stats_text, 
             transform=plt.gca().transAxes, 
             fontsize=11, 
             verticalalignment='bottom', 
             horizontalalignment='right',
             bbox=dict(boxstyle='round', facecolor='white', alpha=0.8, edgecolor='gray'))

    plt.title('Phân tích Mô hình: Train Accuracy vs Test Accuracy vs Loss', fontsize=14, pad=20)
    plt.xlabel('Số lượng mẫu huấn luyện (Training Size)', fontsize=11)
    plt.ylabel('Giá trị (%)', fontsize=11)
    
    # Legend chính (để ở phía trên)
    plt.legend(loc='upper right')
    plt.grid(True, linestyle=':', alpha=0.6)
    
    plt.tight_layout()
    plt.savefig('accur_anomaly_train_test.png')
    print("📊 Đã lưu biểu đồ kèm bảng thông số 3 hàng ở góc phải.")

    # --- LƯU MODEL ---
    final_model = IsolationForest(n_estimators=300, contamination=0.01, random_state=42)
    final_model.fit(scaled_data[:400])
    
    model_dir = 'models'
    if not os.path.exists(model_dir): os.makedirs(model_dir)

    if test_accuracies[-1] >= 90:
        joblib.dump(final_model, os.path.join(model_dir, 'anomaly_model.pkl'))
        joblib.dump(scaler, os.path.join(model_dir, 'scaler.pkl'))
        print("✨ Model saved successfully.")

if __name__ == "__main__":
    train_model()