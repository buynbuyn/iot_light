const pool = require("../db");

async function updateEnergySummary() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        await client.query(`
            INSERT INTO energy_summary (zone_id, month, total_kwh, total_cost)
            SELECT 
                s.zone_id,
                DATE_TRUNC('month', s.timestamp) AS month,

                SUM(s.power_consumption) / 1000 AS total_kwh,

                -- 👉 tính tiền theo giá điện
                (SUM(s.power_consumption) / 1000) * COALESCE(p.price_per_kwh, 0) AS total_cost

            FROM sensor_logs s

            -- 👉 lấy giá điện gần nhất theo thời gian
            LEFT JOIN LATERAL (
                SELECT price_per_kwh
                FROM electricity_price
                WHERE effective_date <= s.timestamp
                ORDER BY effective_date DESC
                LIMIT 1
            ) p ON true

            GROUP BY 
                s.zone_id, 
                DATE_TRUNC('month', s.timestamp),
                p.price_per_kwh

            ON CONFLICT (zone_id, month)
            DO UPDATE SET
                total_kwh = EXCLUDED.total_kwh,
                total_cost = EXCLUDED.total_cost;
        `);

        await client.query("COMMIT");

        console.log("✅ Energy summary updated");

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("❌ Energy summary error:", err.message);

    } finally {
        client.release();
    }
}

// chạy ngay khi start
updateEnergySummary();

// chạy mỗi 1 giờ
setInterval(updateEnergySummary, 60 * 60 * 1000);

console.log("⚡ EnergySummary Cron started (every 1 hour)");

module.exports = { updateEnergySummary };