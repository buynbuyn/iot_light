import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error
import psycopg2
from psycopg2.extras import RealDictCursor
import warnings
warnings.filterwarnings('ignore')

# ==========================================
# CẤU HÌNH
# ==========================================
NEON_CONNECTION_STRING = (
    "postgresql://neondb_owner:npg_alivbegXt69m@ep-bitter-mode-a1h4kt9i-pooler.ap-southeast-1.aws.neon.tech/iot_db?sslmode=require&channel_binding=require"
)

N_MONTHS   = 5    # Cửa sổ train+test: 4 tháng train, 1 tháng test
MA_WINDOW  = 3    # Cửa sổ Moving Average để làm mượt
OUTPUT_PNG = "energy_forecast.png"

# ==========================================
# 1. LẤY DỮ LIỆU TỪ NEON
# ==========================================
def fetch_data(conn_str: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    conn = psycopg2.connect(conn_str)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT zone_id, month::date AS month,
                   total_wh::float AS total_wh,
                   total_cost::float AS total_cost
            FROM energy_summary
            ORDER BY zone_id, month
        """)
        df_energy = pd.DataFrame(cur.fetchall())

        cur.execute("""
            SELECT effective_date::date AS effective_date,
                   price_per_kwh::float AS price_per_kwh
            FROM electricity_price
            ORDER BY effective_date
        """)
        df_prices = pd.DataFrame(cur.fetchall())

    conn.close()
    df_energy['month']          = pd.to_datetime(df_energy['month'])
    df_prices['effective_date'] = pd.to_datetime(df_prices['effective_date'])
    return df_energy, df_prices


def get_price(df_prices: pd.DataFrame, date: pd.Timestamp) -> float:
    subset = df_prices[df_prices['effective_date'] <= date]
    if subset.empty:
        return df_prices['price_per_kwh'].iloc[0]
    return subset.sort_values('effective_date', ascending=False).iloc[0]['price_per_kwh']


# ==========================================
# 2. PHÂN TÍCH & VẼ BIỂU ĐỒ CHO 1 ZONE
# ==========================================
def analyze_zone(ax, zone, zone_data: pd.DataFrame, df_prices: pd.DataFrame) -> dict | None:
    zone_data = zone_data.sort_values('month').reset_index(drop=True)

    if len(zone_data) < 2:
        ax.set_title(f'ZONE {zone}\n(Không đủ dữ liệu)', fontsize=12, color='gray')
        ax.axis('off')
        return None

    # Cửa sổ N_MONTHS gần nhất để train/test
    recent = zone_data.tail(N_MONTHS).reset_index(drop=True)
    recent['time_index'] = np.arange(len(recent))

    train_data = recent.iloc[:-1].copy()   # 4 tháng train
    test_row   = recent.iloc[-1]           # 1 tháng test
    test_month = test_row['month']
    price_test = get_price(df_prices, test_month)

    y_raw = train_data['total_wh'].values

    # ── BƯỚC 1: Moving Average làm mượt dữ liệu train ──────────────────────
    win         = min(MA_WINDOW, len(y_raw))
    y_smoothed  = pd.Series(y_raw).rolling(window=win, min_periods=1).mean().values
    train_data  = train_data.copy()
    train_data['smoothed_wh'] = y_smoothed

    # ── BƯỚC 2: Linear Regression học trên dữ liệu đã làm mượt ────────────
    X_train = train_data[['time_index']]
    lr      = LinearRegression().fit(X_train, y_smoothed)

    # Dự đoán tháng test
    pred_wh   = max(lr.predict([[len(train_data)]])[0], 0)
    pred_cost = pred_wh * (price_test / 1000)

    # MSE giữa dữ liệu gốc và đường hồi quy trên smoothed
    train_mse = mean_squared_error(y_raw, lr.predict(X_train))

    # Thực tế
    actual_wh   = test_row['total_wh']
    actual_cost = test_row['total_cost']
    error_wh    = abs(actual_wh - pred_wh)
    accuracy    = max(0.0, 100 - error_wh / actual_wh * 100) if actual_wh else 0

    # ── VẼ ─────────────────────────────────────────────────────────────────
    last_train_month = train_data['month'].iloc[-1]
    last_smooth_wh   = train_data['smoothed_wh'].iloc[-1]

    # Lịch sử ngoài cửa sổ (xám nhạt)
    history = zone_data[zone_data['month'] < train_data['month'].iloc[0]]
    if not history.empty:
        ax.plot(history['month'], history['total_wh'],
                marker='s', color='gray', linewidth=1.5, linestyle=':', alpha=0.5,
                label='Lịch sử')
        ax.plot([history['month'].iloc[-1], train_data['month'].iloc[0]],
                [history['total_wh'].iloc[-1], train_data['total_wh'].iloc[0]],
                color='gray', linewidth=1.5, linestyle=':', alpha=0.5)
        for _, row in history.iterrows():
            ax.annotate(f"{row['total_wh']:.1f}",
                        xy=(row['month'], row['total_wh']),
                        xytext=(0, 8), textcoords='offset points',
                        ha='center', fontsize=7.5, color='gray')

    # Dữ liệu gốc train (đen, đứt nét nhạt)
    ax.plot(train_data['month'], train_data['total_wh'],
            marker='o', color='black', linewidth=1.5, linestyle='--', alpha=0.4,
            label='Raw data (train)')
    for _, row in train_data.iterrows():
        ax.annotate(f"{row['total_wh']:.1f}",
                    xy=(row['month'], row['total_wh']),
                    xytext=(0, -14), textcoords='offset points',
                    ha='center', fontsize=8, color='black', alpha=0.6)

    # Đường MA làm mượt (cam đậm, liền nét)
    ax.plot(train_data['month'], train_data['smoothed_wh'],
            marker='o', color='darkorange', linewidth=2.5,
            label=f'MA smoothed (window={win})')
    for _, row in train_data.iterrows():
        ax.annotate(f"{row['smoothed_wh']:.1f}",
                    xy=(row['month'], row['smoothed_wh']),
                    xytext=(0, 8), textcoords='offset points',
                    ha='center', fontsize=8, color='darkorange', fontweight='bold')

    # Đường hồi quy LR trên smoothed (xanh dương, kéo dài đến tháng test)
    x_line  = np.array([0, len(train_data)])
    y_line  = lr.predict(x_line.reshape(-1, 1))
    months_line = [train_data['month'].iloc[0], test_month]
    ax.plot(months_line, [max(y_line[0], 0), max(y_line[1], 0)],
            color='royalblue', linewidth=2, linestyle='-',
            label='LR trend (trên smoothed)')

    # Điểm dự đoán
    ax.scatter([test_month], [pred_wh],
               color='royalblue', marker='*', s=280, zorder=6,
               label=f'Dự đoán: {pred_wh:.2f} Wh')
    ax.plot([last_train_month, test_month], [last_smooth_wh, pred_wh],
            color='royalblue', linestyle='--', alpha=0.5)
    ax.annotate(f"Dự đoán:\n{pred_wh:.2f} Wh",
                xy=(test_month, pred_wh), xytext=(8, 6), textcoords='offset points',
                color='royalblue', fontsize=9, fontweight='bold')

    # Thực tế
    ax.scatter([test_month], [actual_wh],
               color='crimson', marker='o', s=160, zorder=7, label='Thực tế')
    ax.plot([last_train_month, test_month], [last_smooth_wh, actual_wh],
            color='crimson', linestyle='-', alpha=0.4)
    ax.annotate(f"Thực tế:\n{actual_wh:.2f} Wh",
                xy=(test_month, actual_wh), xytext=(8, -28), textcoords='offset points',
                color='crimson', fontsize=9, fontweight='bold')

    ax.set_title(
        f'ZONE {zone}  –  Test: {test_month.strftime("%m/%Y")}\n'
        f'Accuracy: {accuracy:.1f}%  |  MSE: {train_mse:.2f}',
        fontsize=12, fontweight='bold'
    )
    ax.set_ylabel('Wh', fontsize=10)
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%Y'))
    ax.tick_params(axis='x', rotation=45)
    ax.grid(True, linestyle='--', alpha=0.4)
    ax.legend(fontsize=8, loc='upper left')

    return dict(
        zone=zone, test_month=test_month,
        n_train=len(train_data),
        train_months=list(train_data['month'].dt.strftime('%m/%Y')),
        y_raw=list(y_raw), y_smoothed=list(y_smoothed),
        pred_wh=pred_wh, pred_cost=pred_cost,
        actual_wh=actual_wh, actual_cost=actual_cost,
        error_wh=error_wh, accuracy=accuracy, train_mse=train_mse,
    )


# ==========================================
# 3. MAIN
# ==========================================
def main():
    print("Dang ket noi Neon va lay du lieu ...")
    df_energy, df_prices = fetch_data(NEON_CONNECTION_STRING)

    all_months = sorted(df_energy['month'].dt.strftime('%m/%Y').unique())
    print(f"Tat ca cac thang trong DB: {all_months}")

    zones  = sorted(df_energy['zone_id'].unique())
    ncols  = min(3, len(zones))
    nrows  = (len(zones) + ncols - 1) // ncols
    fig, axes = plt.subplots(nrows, ncols,
                             figsize=(7 * ncols, 6 * nrows),
                             squeeze=False)

    print("\n" + "=" * 90)
    print("BAO CAO: MA SMOOTHING + LR PREDICTION")
    print("Quy trinh: raw data -> Moving Average lam muot -> Linear Regression du doan")
    print("=" * 90)

    for i, zone in enumerate(zones):
        row_idx, col_idx = divmod(i, ncols)
        res = analyze_zone(axes[row_idx][col_idx],
                           zone,
                           df_energy[df_energy['zone_id'] == zone].copy(),
                           df_prices)
        if res is None:
            continue
        r = res
        print(f"\n ZONE {r['zone']}  |  Train: {r['train_months']}  |  Test: {r['test_month'].strftime('%m/%Y')}")
        print(f"   Raw Wh     : {[f'{v:.2f}' for v in r['y_raw']]}")
        print(f"   Smoothed Wh: {[f'{v:.2f}' for v in r['y_smoothed']]}")
        print(f"   Du doan    : {r['pred_wh']:.4f} Wh")
        print(f"   Thuc te    : {r['actual_wh']:.4f} Wh")
        print(f"   Sai so     : {r['error_wh']:.4f} Wh")
        print(f"   Accuracy   : {r['accuracy']:.2f}%")
        print(f"   Train MSE  : {r['train_mse']:.4f}")
        print("-" * 90)

    for j in range(len(zones), nrows * ncols):
        row_idx, col_idx = divmod(j, ncols)
        axes[row_idx][col_idx].set_visible(False)

    fig.suptitle(
        f'MA Smoothing + Linear Regression  –  {N_MONTHS} thang gan nhat (4 train / 1 test)',
        fontsize=15, fontweight='bold', y=1.01
    )
    plt.tight_layout()
    plt.savefig(OUTPUT_PNG, dpi=150, bbox_inches='tight')
    print(f"\nBieu do da luu ra: {OUTPUT_PNG}")
    plt.close()


if __name__ == "__main__":
    main()