import sys
import os
import json
import pickle
import pandas as pd
import numpy as np
from sklearn.metrics import mean_squared_error

# 1. Cấu hình đường dẫn
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PKL_PATH = os.path.join(BASE_DIR, "models", "trainmodel.pkl")

try:
    # Đọc file model
    if not os.path.exists(PKL_PATH):
        raise FileNotFoundError(f"Missing pkl file at {PKL_PATH}")

    with open(PKL_PATH, 'rb') as f:
        bundle = pickle.load(f)

    # Nhận dữ liệu từ Node.js
    input_data = json.loads(sys.argv[1])
    df = pd.DataFrame(input_data)
    
    if df.empty:
        raise ValueError("Input data is empty")

    # Ép kiểu dữ liệu
    df['total_wh'] = pd.to_numeric(df['total_wh'], errors='coerce').fillna(0)
    target_zone = str(df['zone_id'].iloc[0])

    # ĐỊNH NGHĨA models_dict TẠI ĐÂY (Ép key sang string để tránh lỗi int64)
    models_dict = {str(k): v for k, v in bundle['models'].items()}

    if target_zone not in models_dict:
        print(json.dumps({
            "error": f"Zone {target_zone} not found",
            "available": list(models_dict.keys())
        }))
        sys.exit(0)

    # 2. Lấy thông tin model gốc
    zone_info = models_dict[target_zone]
    trained_model = zone_info['model']
    last_index = int(zone_info['last_time_index'])
    saved_train_accuracy = float(zone_info['avg_accuracy'])
    
    # Lấy window từ config trong pkl (thường là 3)
    ma_window = int(bundle.get('config', {}).get('ma_window', 3))

    # 3. LÀM MƯỢT DỮ LIỆU MỚI (MA)
    # Sắp xếp để tính MA chính xác
    df = df.sort_values('month').reset_index(drop=True)
    df['ma_val'] = df['total_wh'].rolling(window=ma_window, min_periods=1).mean()
    
    # Lấy giá trị MA mới nhất để so sánh xu hướng
    latest_ma_actual = float(df['ma_val'].iloc[-1])

    # 4. DỰ ĐOÁN KẾ THỪA XU HƯỚNG
    # Dự đoán tại thời điểm hiện tại của model gốc
    current_pred = float(trained_model.predict([[last_index]])[0])
    
    # Tính độ lệch (Bias) giữa thực tế đã làm mượt và dự đoán cũ
    bias = latest_ma_actual - current_pred

    # Dự đoán tháng tiếp theo = Xu hướng gốc + Độ lệch thực tế
    next_index = last_index + 1
    trend_future = float(trained_model.predict([[next_index]])[0])
    final_prediction = max(0, trend_future + bias)

    # 5. ĐÁNH GIÁ (EVALUATION)
    # Tạo index cho tập dữ liệu gửi qua
    df['time_index'] = np.arange(last_index - len(df) + 1, last_index + 1)
    y_actual_raw = df['total_wh'].values
    y_ma = df['ma_val'].values
    y_pred_trend = np.maximum(trained_model.predict(df[['time_index']]), 0)

    mse = float(mean_squared_error(y_ma, y_pred_trend))
    
    # Tính accuracy giữa MA thực tế và đường xu hướng
    acc_list = []
    for a, p in zip(y_ma, y_pred_trend):
        acc = max(0, 100 - abs(a - p) / a * 100) if a > 0 else 0
        acc_list.append(acc)
    avg_acc = float(np.mean(acc_list))

    # 6. TRẢ KẾT QUẢ
    print(json.dumps({
        "predicted_wh": round(final_prediction, 2),
        "model_used": "Linear Regression + MA Offset",
        "zone_used": target_zone,
        "evaluation": {
            "mse": round(mse, 2),
            "avg_accuracy": round(avg_acc, 2),
            "train_accuracy_from_pkl": round(saved_train_accuracy, 2),
            "status": "Ổn định" if avg_acc > (saved_train_accuracy * 0.8) else "Cần train lại"
        }
    }))

except Exception as e:
    # Trường hợp có lỗi bất ngờ, vẫn trả về JSON để Node.js không bị crash
    print(json.dumps({"error": str(e)}))
    sys.exit(0)