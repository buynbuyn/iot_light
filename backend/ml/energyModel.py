import sys
import os
import json
import pickle
import pandas as pd
import numpy as np
from sklearn.metrics import mean_squared_error

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PKL_PATH = os.path.join(BASE_DIR, "models", "trainmodel.pkl")

try:
    with open(PKL_PATH, 'rb') as f:
        bundle = pickle.load(f)
    data = json.loads(sys.argv[1])
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(0)

df = pd.DataFrame(data)
df['total_wh'] = pd.to_numeric(df['total_wh'], errors='coerce').fillna(0)
target_zone = str(df['zone_id'].iloc[0])

models_dict = {str(k): v for k, v in bundle['models'].items()}

if target_zone not in models_dict:
    print(json.dumps({"error": f"Zone {target_zone} chưa được train"}))
    sys.exit(0)

zone_info = models_dict[target_zone]
trained_model = zone_info['model'] 
last_index = int(zone_info['last_time_index'])
saved_accuracy = float(zone_info['avg_accuracy'])

latest_actual = float(df['total_wh'].iloc[-1])

current_pred = float(trained_model.predict([[last_index]])[0])

bias = latest_actual - current_pred

next_index = last_index + 1
trend_prediction = float(trained_model.predict([[next_index]])[0])

final_prediction = max(0, trend_prediction + bias)

df['time_index'] = np.arange(last_index - len(df) + 1, last_index + 1)
X_test = df[['time_index']]
y_actual = df['total_wh'].values
y_pred_trend = np.maximum(trained_model.predict(X_test), 0)

mse = float(mean_squared_error(y_actual, y_pred_trend))
avg_acc = float(np.mean([max(0, 100 - abs(a - p) / a * 100) if a > 0 else 0 for a, p in zip(y_actual, y_pred_trend)]))

print(json.dumps({
    "predicted_wh": round(final_prediction, 2),
    "model_used": "Linear Regression (Trend Following)",
    "zone_used": target_zone,
    "evaluation": {
        "mse": round(mse, 2),
        "avg_accuracy": round(avg_acc, 2),
        "train_accuracy_from_pkl": round(saved_accuracy, 2),
        "status": "Ổn định" if avg_acc > (saved_accuracy * 0.8) else "Lệch xu hướng (Cần train lại)"
    }
}))