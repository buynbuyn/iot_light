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
    with open(PKL_PATH, 'rb') as f:
        bundle = pickle.load(f)

    data = json.loads(sys.argv[1])
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(0)

df = pd.DataFrame(data)

if len(df) < 5:
    print(json.dumps({
        "predicted_wh": 0,
        "error": "Not enough data (need >=5)"
    }))
    sys.exit(0)

df['total_wh'] = pd.to_numeric(df['total_wh'], errors='coerce').fillna(0)

zone_id = df['zone_id'].iloc[0] if 'zone_id' in df.columns else None

if zone_id and 'models' in bundle and zone_id in bundle['models']:
    saved_train_accuracy = bundle['models'][zone_id]['avg_accuracy']
else:
    first_zone = list(bundle['models'].keys())[0]
    saved_train_accuracy = bundle['models'][first_zone]['avg_accuracy']
    zone_id = first_zone

df = df.sort_values('month').reset_index(drop=True)
df['time_index'] = np.arange(len(df))

df['ma'] = df['total_wh'].rolling(window=3, min_periods=1).mean()

model = LinearRegression()

X = df[['time_index']]
y = df['ma']   

model.fit(X, y)

TEST_SIZE = 3
test_df = df.iloc[-TEST_SIZE:]

X_test = test_df[['time_index']]
y_test = test_df['total_wh']

y_pred_test = model.predict(X_test)
y_pred_test = np.maximum(y_pred_test, 0)


mse = mean_squared_error(y_test, y_pred_test)

accuracy_list = []
for actual, pred in zip(y_test, y_pred_test):
    if actual == 0:
        acc = 0
    else:
        acc = max(0, 100 - abs(actual - pred) / actual * 100)
    accuracy_list.append(acc)

avg_accuracy = np.mean(accuracy_list)

if avg_accuracy >= (saved_train_accuracy * 0.9):
    threshold_status = "Đạt ngưỡng (Ổn định)"
else:
    threshold_status = "Dưới ngưỡng (Cần train lại model gốc)"

next_index = np.array([[len(df)]])
next_pred = model.predict(next_index)[0]
next_pred = max(next_pred, 0)

print(json.dumps({
    "predicted_wh": round(float(next_pred), 2),
    "model_used": "Linear Regression",
    "zone_used": str(zone_id),

    "evaluation": {
        "mse": round(float(mse), 2),
        "test_accuracy": round(float(avg_accuracy), 2),
        "train_accuracy_from_pkl": round(float(saved_train_accuracy), 2),
        "status": threshold_status
    },

    "test_detail": [
        {
            "actual": round(float(a), 2),
            "predicted": round(float(p), 2)
        }
        for a, p in zip(y_test, y_pred_test)
    ]
}))