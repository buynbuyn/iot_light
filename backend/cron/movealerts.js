const pool = require("../db");

async function moveExpiredAlerts() {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const moved = await client.query(`
      INSERT INTO anomaly_history (zone_id, log_id, detected_time, anomaly_type, severity)
      SELECT zone_id, NULL, detected_time, alert_type, severity
      FROM alerts
      WHERE detected_time < NOW() - INTERVAL '24 hours'
      RETURNING *
    `);

        await client.query(`
      DELETE FROM alerts
      WHERE detected_time < NOW() - INTERVAL '24 hours'
    `);

        await client.query("COMMIT");

        if (moved.rowCount > 0) {
            console.log(`[MoveAlert] Moved ${moved.rowCount} alert(s) to history.`);
        }
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("[MoveAlert] Failed:", err.message);
    } finally {
        client.release();
    }
}

// Chạy ngay khi server khởi động
moveExpiredAlerts();

// Sau đó cứ mỗi 1 giờ check lại
const INTERVAL_MS = 60 * 60 * 1000; // đổi thành 60 * 1000 nếu muốn check mỗi phút
setInterval(moveExpiredAlerts, INTERVAL_MS);

console.log("[MoveAlert] Scheduler started — checking every 1 hour.");

module.exports = { moveExpiredAlerts };