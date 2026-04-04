const express = require("express");
const router = express.Router();
const pool = require("../db");

// ================= INSERT SENSOR DATA =================
router.post("/sensor-data", async (req, res) => {
  try {
    const {
      zone_id,
      motion_detected,
      brightness_level,
      current_value,
      voltage,
      power_consumption
    } = req.body;

    if (!zone_id) {
      return res.status(400).json({
        success: false,
        message: "zone_id is required"
      });
    }

    const query = `
      INSERT INTO sensor_logs (
        zone_id,
        timestamp,
        motion_detected,
        brightness_level,
        current_value,
        voltage,
        power_consumption
      )
      VALUES ($1, NOW(), $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const values = [
      zone_id,
      motion_detected,
      brightness_level,
      current_value,
      voltage,
      power_consumption
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: "Data inserted",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Insert error:", error);

    res.status(500).json({
      success: false,
      message: "Insert failed",
      error: error.message
    });
  }
});

// ================= GET LATEST =================
router.get("/latest", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM sensor_logs
      ORDER BY timestamp DESC
      LIMIT 1;
    `);

    res.json(result.rows[0] || null);
  } catch (error) {
    console.error("Latest error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= GET LOGS =================
router.get("/logs", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM sensor_logs
      ORDER BY timestamp DESC
      LIMIT 50;
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Logs error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= INSERT ALERT =================
router.post("/alert/raw", async (req, res) => {
  try {
    const { zone_id, alert_type, severity, status } = req.body;

    if (!zone_id || !alert_type) {
      return res.status(400).json({
        success: false,
        message: "zone_id and alert_type are required"
      });
    }

    const query = `
      INSERT INTO alerts (zone_id, alert_type, severity, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const values = [
      zone_id,
      alert_type,
      severity || "medium",
      status || "unresolved"
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: "Alert inserted",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Alert insert error:", error);
    res.status(500).json({
      success: false,
      message: "Insert alert failed",
      error: error.message
    });
  }
});

module.exports = router;