import sys
import os
import json
import pickle
import pandas as pd
import numpy as np
from sklearn.metrics import mean_squared_error
from sklearn.linear_model import LinearRegression

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PKL_PATH = os.path.join(BASE_DIR, "models", "trainmodel.pkl")

try:
    if not os.path.exists(PKL_PATH):
        raise FileNotFoundError(f"Missing pkl file at {PKL_PATH}")

    with open(PKL_PATH, 'rb') as f:
        bundle = pickle.load(f)

    input_data = json.loads(sys.argv[1])
    df = pd.DataFrame(input_data)

    if df.empty:
        raise ValueError("Input data is empty")

    df['total_wh'] = pd.to_numeric(df['total_wh'], errors='coerce').fillna(0)
    df = df.sort_values('month').reset_index(drop=True)

    target_zone = str(df['zone_id'].iloc[0])

    models_dict = {str(k): v for k, v in bundle['models'].items()}

    if target_zone not in models_dict:
        print(json.dumps({
            "error": f"Zone {target_zone} not found",
            "available": list(models_dict.keys())
        }))
        sys.exit(0)

    zone_info = models_dict[target_zone]
    saved_train_accuracy = float(zone_info.get('avg_accuracy', 0))

    ma_window = int(bundle.get('config', {}).get('ma_window', 3))

    df['ma_val'] = df['total_wh'].rolling(
        window=ma_window,
        min_periods=1
    ).mean()

    ma_values = df['ma_val'].values

    X = np.arange(len(ma_values)).reshape(-1, 1)
    y = ma_values

    model = LinearRegression()
    model.fit(X, y)

    next_x = np.array([[len(ma_values)]])
    final_prediction = float(model.predict(next_x)[0])

    y_pred = model.predict(X)

    mse = float(mean_squared_error(y, y_pred))

    acc_list = []
    for actual, pred in zip(y, y_pred):
        if actual > 0:
            acc = max(0, 100 - abs(actual - pred) / actual * 100)
        else:
            acc = 0
        acc_list.append(acc)

    avg_acc = float(np.mean(acc_list))

    slope = float(model.coef_[0])
    intercept = float(model.intercept_)

    print(json.dumps({
        "predicted_wh": round(final_prediction, 2),
        "model_used": "Linear Regressions",
        "zone_used": target_zone,

        "ma_window": ma_window,
        "ma_values": [round(float(x), 2) for x in ma_values],

        "slope": round(slope, 4),
        "intercept": round(intercept, 4),

        "evaluation": {
            "mse": round(mse, 2),
            "avg_accuracy": round(avg_acc, 2),
            "train_accuracy_from_pkl": round(saved_train_accuracy, 2),
            "status": "Ổn định" if avg_acc >= 90 else "Cần train lại"
        }
    }))

except Exception as e:
    print(json.dumps({
        "error": str(e)
    }))
    sys.exit(0)