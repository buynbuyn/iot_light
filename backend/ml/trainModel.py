import os
import pickle
import warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score

warnings.filterwarnings("ignore")

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
ML_DIR      = BASE_DIR
BACKEND_PUBLIC_DIR = os.path.abspath(
    os.path.join(BASE_DIR, "models")
)

OUTPUT_PKL  = os.path.join(BACKEND_PUBLIC_DIR, "trainmodel.pkl")

FRONTEND_PUBLIC_DIR = os.path.abspath(
    os.path.join(BASE_DIR, "../../frontend/public")
)

OUTPUT_PNG = os.path.join(FRONTEND_PUBLIC_DIR, "energy_forecast.png")

NEON_CONNECTION_STRING = (
    "postgresql://neondb_owner:npg_alivbegXt69m@ep-bitter-mode-a1h4kt9i-pooler"
    ".ap-southeast-1.aws.neon.tech/iot_db?sslmode=require&channel_binding=require"
)
N_TRAIN    = 3
N_TEST     = 2
MA_WINDOW  = 3


def mean_absolute_percentage_error(y_actual: np.ndarray, y_pred: np.ndarray) -> float:
    """
    MAPE = (1/n) * Σ |( Y_i - Ŷ_i ) / Y_i| * 100
    Bỏ qua các điểm có y_actual = 0 để tránh chia-cho-0.
    """
    mask = y_actual != 0
    if not mask.any():
        return 0.0
    return float(np.mean(np.abs((y_actual[mask] - y_pred[mask]) / y_actual[mask])) * 100)

def fetch_from_neon() -> tuple[pd.DataFrame, pd.DataFrame]:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    conn = psycopg2.connect(NEON_CONNECTION_STRING)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT zone_id, month::date AS month,
                   total_wh::float AS total_wh,
                   total_cost::float AS total_cost
            FROM energy_summary ORDER BY zone_id, month
        """)
        df_energy = pd.DataFrame(cur.fetchall())
        cur.execute("""
            SELECT effective_date::date AS effective_date,
                   price_per_kwh::float AS price_per_kwh
            FROM electricity_price ORDER BY effective_date
        """)
        df_prices = pd.DataFrame(cur.fetchall())
    conn.close()
    df_energy["month"]          = pd.to_datetime(df_energy["month"])
    df_prices["effective_date"] = pd.to_datetime(df_prices["effective_date"])
    return df_energy, df_prices


def make_mock_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    rng    = np.random.default_rng(42)
    months = pd.date_range("2024-01-01", periods=8, freq="MS")
    rows   = []
    for zone in ["A", "B", "C"]:
        base = rng.uniform(5000, 15000)
        for i, m in enumerate(months):
            wh = base + i * rng.uniform(100, 400) + rng.normal(0, 300)
            rows.append({"zone_id": zone, "month": m,
                         "total_wh": max(wh, 0),
                         "total_cost": max(wh, 0) * 2.5 / 1000})
    df_energy = pd.DataFrame(rows)
    df_prices = pd.DataFrame([
        {"effective_date": pd.Timestamp("2024-01-01"), "price_per_kwh": 2.5}
    ])
    return df_energy, df_prices


def get_price(df_prices: pd.DataFrame, date: pd.Timestamp) -> float:
    subset = df_prices[df_prices["effective_date"] <= date]
    if subset.empty:
        return float(df_prices["price_per_kwh"].iloc[0])
    return float(subset.sort_values("effective_date", ascending=False).iloc[0]["price_per_kwh"])


# ── Train + Test + Vẽ cho 1 zone ─────────────────────────────────────────────
def process_zone(ax, zone: str, zone_data: pd.DataFrame,
                 df_prices: pd.DataFrame) -> dict | None:
    zone_data = zone_data.sort_values("month").reset_index(drop=True)
    n_window  = N_TRAIN + N_TEST

    if len(zone_data) < n_window:
        ax.set_title(f"ZONE {zone}\n(Không đủ dữ liệu)", color="gray", fontsize=12)
        ax.axis("off")
        return None

    # Tách cửa sổ train / test
    recent = zone_data.tail(n_window).reset_index(drop=True)
    recent["time_index"] = np.arange(len(recent))

    train_df = recent.iloc[:N_TRAIN].copy()
    test_df  = recent.iloc[N_TRAIN:].copy()

    # MA smoothing trên tập train
    win        = min(MA_WINDOW, N_TRAIN)
    y_raw      = train_df["total_wh"].values
    y_smoothed = pd.Series(y_raw).rolling(window=win, min_periods=1).mean().values
    train_df["smoothed_wh"] = y_smoothed

    X_train = train_df[["time_index"]]
    model   = LinearRegression().fit(X_train, y_smoothed)

    X_test   = test_df[["time_index"]]
    y_pred   = np.maximum(model.predict(X_test), 0)
    y_actual = test_df["total_wh"].values
    test_df  = test_df.copy()
    test_df["pred_wh"] = y_pred

    y_train_pred = model.predict(X_train)
    rss_train = float(np.sum((y_smoothed - y_train_pred) ** 2))

    rmse_test  = float(np.sqrt(mean_squared_error(y_actual, y_pred)))
    rmse_train = float(np.sqrt(mean_squared_error(y_smoothed, y_train_pred)))

    if len(y_actual) >= 2:
        r2_test = float(r2_score(y_actual, y_pred))
    else:
        ss_res = float(np.sum((y_actual - y_pred) ** 2))
        ss_tot = float(np.sum((y_actual - np.mean(y_actual)) ** 2))
        r2_test = 1 - ss_res / ss_tot if ss_tot != 0 else 0.0

    r2_train = float(r2_score(y_smoothed, y_train_pred))

    mape_test  = mean_absolute_percentage_error(y_actual, y_pred)
    mape_train = mean_absolute_percentage_error(y_smoothed, y_train_pred)

    avg_acc = max(0.0, 100 - mape_test)

    # ── Vẽ biểu đồ ───────────────────────────────────────────────────────────
    last_train_month = train_df["month"].iloc[-1]
    last_smooth_wh   = float(train_df["smoothed_wh"].iloc[-1])

    history = zone_data[zone_data["month"] < train_df["month"].iloc[0]]
    if not history.empty:
        ax.plot(history["month"], history["total_wh"],
                marker="s", color="gray", linewidth=1.5, linestyle=":", alpha=0.5,
                label="Lịch sử")
        ax.plot([history["month"].iloc[-1], train_df["month"].iloc[0]],
                [history["total_wh"].iloc[-1], train_df["total_wh"].iloc[0]],
                color="gray", linewidth=1.2, linestyle=":", alpha=0.4)
        for _, row in history.iterrows():
            ax.annotate(f"{row['total_wh']:.1f}",
                        xy=(row["month"], row["total_wh"]),
                        xytext=(0, 8), textcoords="offset points",
                        ha="center", fontsize=7, color="gray")

    # Raw train (đen nhạt, đứt)
    ax.plot(train_df["month"], train_df["total_wh"],
            marker="o", color="black", linewidth=1.5, linestyle="--", alpha=0.35,
            label="Raw train")
    for _, row in train_df.iterrows():
        ax.annotate(f"{row['total_wh']:.1f}",
                    xy=(row["month"], row["total_wh"]),
                    xytext=(0, -14), textcoords="offset points",
                    ha="center", fontsize=7.5, color="black", alpha=0.55)

    # MA smoothed (cam đậm)
    ax.plot(train_df["month"], train_df["smoothed_wh"],
            marker="o", color="darkorange", linewidth=2.5,
            label=f"MA smoothed (w={win})")
    for _, row in train_df.iterrows():
        ax.annotate(f"{row['smoothed_wh']:.1f}",
                    xy=(row["month"], row["smoothed_wh"]),
                    xytext=(0, 9), textcoords="offset points",
                    ha="center", fontsize=7.5, color="darkorange", fontweight="bold")

    # LR trend kéo qua test
    x_lr      = np.array([0, len(recent) - 1])
    y_lr      = np.maximum(model.predict(x_lr.reshape(-1, 1)), 0)
    months_lr = [train_df["month"].iloc[0], test_df["month"].iloc[-1]]
    ax.plot(months_lr, [y_lr[0], y_lr[1]],
            color="royalblue", linewidth=2, linestyle="-",
            label="LR trend")

    # Điểm dự đoán (test)
    prev_m_pred = last_train_month
    prev_y_pred = last_smooth_wh
    first_pred  = True
    for _, row in test_df.iterrows():
        ax.scatter([row["month"]], [row["pred_wh"]],
                   color="royalblue", marker="*", s=300, zorder=6,
                   label="Dự đoán (test)" if first_pred else "")
        ax.plot([prev_m_pred, row["month"]], [prev_y_pred, row["pred_wh"]],
                color="royalblue", linestyle="--", alpha=0.45)
        ax.annotate(f"Dự đoán:\n{row['pred_wh']:.2f} Wh",
                    xy=(row["month"], row["pred_wh"]),
                    xytext=(10, 6), textcoords="offset points",
                    color="royalblue", fontsize=8.5, fontweight="bold")
        prev_m_pred = row["month"]
        prev_y_pred = row["pred_wh"]
        first_pred  = False

    # Điểm thực tế (test)
    prev_m_act = last_train_month
    prev_y_act = last_smooth_wh
    first_act  = True
    for _, row in test_df.iterrows():
        ax.scatter([row["month"]], [row["total_wh"]],
                   color="crimson", marker="o", s=170, zorder=7,
                   label="Thực tế (test)" if first_act else "")
        ax.plot([prev_m_act, row["month"]], [prev_y_act, row["total_wh"]],
                color="crimson", linestyle="-", alpha=0.35)
        ax.annotate(f"Thực tế:\n{row['total_wh']:.2f} Wh",
                    xy=(row["month"], row["total_wh"]),
                    xytext=(10, -36), textcoords="offset points",
                    color="crimson", fontsize=8.5, fontweight="bold")
        prev_m_act = row["month"]
        prev_y_act = row["total_wh"]
        first_act  = False

    ax.set_title(
        f"ZONE {zone}\n"
        f"RMSE: {rmse_test:.2f}  |  R²: {r2_test:.4f}  |  MAPE: {mape_test:.2f}%  |  Acc: {avg_acc:.1f}%",
        fontsize=11, fontweight="bold",
    )
    ax.set_ylabel("Wh", fontsize=10)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%m/%Y"))
    ax.tick_params(axis="x", rotation=45)
    ax.grid(True, linestyle="--", alpha=0.35)
    ax.legend(fontsize=8, loc="upper left")

    # ── In báo cáo console ────────────────────────────────────────────────────
    print(f"\n  ZONE {zone}")
    print(f"    Train months : {list(train_df['month'].dt.strftime('%m/%Y'))}")
    print(f"    Raw Wh       : {[round(v,2) for v in y_raw]}")
    print(f"    Smoothed Wh  : {[round(v,2) for v in y_smoothed]}")
    print(f"    RSS (train)  : {rss_train:.4f}  ← OLS tối thiểu hóa giá trị này")
    for idx, row in enumerate(test_df.itertuples()):
        print(f"    [Test {idx+1}] {row.month.strftime('%m/%Y')}  "
              f"Pred: {row.pred_wh:.4f} Wh  Actual: {row.total_wh:.4f} Wh")
    print(f"    ── Metrics (test set) ──────────────────────────────────────────")
    print(f"    RMSE  = √MSE         : {rmse_test:.4f}  (train: {rmse_train:.4f})")
    print(f"    R²                   : {r2_test:.4f}  (train: {r2_train:.4f})  [1=hoàn hảo]")
    print(f"    MAPE                 : {mape_test:.2f}%  (train: {mape_train:.2f}%)")
    print(f"    Accuracy (100-MAPE)  : {avg_acc:.2f}%")
    print("    " + "-" * 74)

    return {
        "model":           model,
        "ma_window":       win,
        "n_train":         N_TRAIN,
        "n_test":          N_TEST,
        "train_months":    list(train_df["month"].dt.strftime("%Y-%m")),
        "test_months":     list(test_df["month"].dt.strftime("%Y-%m")),
        "y_raw":           y_raw.tolist(),
        "y_smoothed":      y_smoothed.tolist(),
        "coef":            float(model.coef_[0]),
        "intercept":       float(model.intercept_),
        "last_time_index": int(recent["time_index"].iloc[-1]),

        "rss_train":       rss_train,    
        "rmse_train":      rmse_train,   
        "rmse_test":       rmse_test,   
        "r2_train":        r2_train,     
        "r2_test":         r2_test,      
        "mape_train":      mape_train,   
        "mape_test":       mape_test,    
        "avg_accuracy":    avg_acc,      
    }


def main():
    try:
        print("Đang kết nối Neon DB …")
        df_energy, df_prices = fetch_from_neon()
        print(f"  Lấy được {len(df_energy)} bản ghi.")
    except Exception as e:
        print(f"  Không kết nối được DB ({e}). Dùng mock data.")
        df_energy, df_prices = make_mock_data()

    zones = sorted(df_energy["zone_id"].unique())
    print(f"  Zones: {zones}")

    ncols = min(3, len(zones))
    nrows = (len(zones) + ncols - 1) // ncols
    fig, axes = plt.subplots(nrows, ncols,
                             figsize=(7 * ncols, 6.5 * nrows),
                             squeeze=False)

    print("\n" + "=" * 80)
    print("BÁO CÁO TRAIN + TEST  –  MA Smoothing + Linear Regression (OLS)")
    print("Metrics: RSS (OLS) | RMSE | R² | MAPE")
    print("=" * 80)

    all_models: dict[str, dict] = {}
    for i, zone in enumerate(zones):
        row_i, col_i = divmod(i, ncols)
        result = process_zone(
            axes[row_i][col_i], zone,
            df_energy[df_energy["zone_id"] == zone].copy(),
            df_prices,
        )
        if result is not None:
            all_models[zone] = result

    for j in range(len(zones), nrows * ncols):
        row_j, col_j = divmod(j, ncols)
        axes[row_j][col_j].set_visible(False)

    fig.suptitle(
        f"Train: {N_TRAIN} tháng  |  Test: {N_TEST} tháng  "
        f"|  Metrics: RMSE / R² / MAPE",
        fontsize=14, fontweight="bold", y=1.01,
    )
    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=150, bbox_inches="tight")
    print(f"\n  Biểu đồ đã lưu ra '{OUTPUT_PNG}'")
    plt.close()

    # Lưu pkl
    bundle = {
        "models":    all_models,
        "df_prices": df_prices,
        "config": {
            "ma_window": MA_WINDOW,
            "n_train":   N_TRAIN,
            "n_test":    N_TEST,
        },
    }
    with open(OUTPUT_PKL, "wb") as f:
        pickle.dump(bundle, f)

    print(f"  Model đã lưu ra '{OUTPUT_PKL}'")
    print(f"  Hình đã lưu ra  '{OUTPUT_PNG}'")
    print(f"\n✅  Hoàn tất train_model.py")
    print(f"\n📁 Cấu trúc output:")
    print(f"   backend/ml/energy_forecast.png")
    print(f"   backend/ml/model/trainmodel.pkl")


if __name__ == "__main__":
    main()