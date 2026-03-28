import sys
import json
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression

# 1. Nhận dữ liệu từ Node
try:
    data = json.loads(sys.argv[1])  # list of {month, total_kwh}
except Exception as e:
    print(json.dumps({
        "predicted_wh": 0,
        "model_used": "Linear Regression",
        "error": f"JSON load failed: {str(e)}"
    }))
    sys.exit(0)

df = pd.DataFrame(data)
if df.empty:
    print(json.dumps({
        "predicted_wh": 0,
        "model_used": "Linear Regression",
        "warning": "Empty data"
    }))
    sys.exit(0)

# 2. Convert sang float và fill NaN
df['total_wh'] = pd.to_numeric(df['total_wh'], errors='coerce').fillna(0)

# 3. Moving Average
df['Wh_ma'] = df['total_wh'].rolling(window=3, min_periods=1).mean().fillna(0)

# 4. Linear Regression
X = np.arange(len(df)).reshape(-1, 1)
y = df['Wh_ma'].values

if len(y) < 2:  # quá ít dữ liệu để fit regression
    predicted_wh = y[-1] if len(y) == 1 else 0
    print(json.dumps({
        "predicted_wh": round(predicted_wh, 2),
        "model_used": "Linear Regression",
        "warning": "Too few data points"
    }))
    sys.exit(0)

model = LinearRegression()
try:
    model.fit(X, y)
except Exception as e:
    print(json.dumps({
        "predicted_wh": 0,
        "model_used": "Linear Regression",
        "error": f"Fit failed: {str(e)}"
    }))
    sys.exit(0)

# 5. Predict tháng tiếp theo
next_index = np.array([[len(df)]])
predicted_wh = model.predict(next_index)[0]

print(json.dumps({
    "predicted_wh": round(predicted_wh, 2),
    "model_used": "Linear Regression"
}))