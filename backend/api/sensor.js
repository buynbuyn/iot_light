const express = require("express");
const db = require("../db");
const { runAnomalyDetection } = require("../service/anomalyService");
const { updateEnergySummary, predictEnergyForZone } = require("../service/energyService");

const router = express.Router();

// Helper để chạy anomaly detection và await kết quả
function runAnomalyDetectionAsync(logId) {
    return new Promise((resolve) => {
        runAnomalyDetection(logId);
        // resolve ngay vì Python spawn async, chỉ để log
        resolve();
    });
}

router.post("/", async (req, res) => {
    const {
        zone_id,
        motion_detected,
        brightness_level,
        current_value,
        voltage,
        power_consumption,
    } = req.body;

    try {
        // 1️⃣ INSERT sensor log
        const result = await db.query(
            `INSERT INTO sensor_logs
             (zone_id, timestamp, motion_detected, brightness_level, current_value, voltage, power_consumption)
             VALUES ($1, NOW(), $2, $3, $4, $5, $6)
             RETURNING log_id, timestamp`,
            [zone_id, motion_detected, brightness_level, current_value, voltage, power_consumption]
        );

        const logId = result.rows[0].log_id;
        const logTimestamp = result.rows[0].timestamp;

        // 2️⃣ RUN anomaly detection (async, không block)
        await runAnomalyDetectionAsync(logId);

        // 3️⃣ Cập nhật energy_summary
        await updateEnergySummary({
            zone_id,
            power_consumption,
            timestamp: logTimestamp
        });

        // 4️⃣ Dự đoán energy cho zone
        let prediction = null;
        try {
            prediction = await predictEnergyForZone(zone_id);
        } catch (e) {
            console.error("⚠️ Prediction failed:", e);
        }

        // 5️⃣ Trả response đầy đủ
        res.json({
            message: "Data saved",
            log_id: logId,
            prediction
        });

    } catch (err) {
        console.error("❌ Sensor POST error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;