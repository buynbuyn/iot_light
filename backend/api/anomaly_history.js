const pool = require("../db");

exports.getAnomalyHistory = async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT *
      FROM anomaly_history
      ORDER BY detected_time DESC
    `);

        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching anomaly history:", err);
        res.status(500).json({ error: "Server error" });
    }
};