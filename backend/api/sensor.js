const express = require("express");
const db = require("../db");
const { runAnomalyDetection } = require("../service/anomalyService");
const {
    updateEnergySummary
} = require("../service/energyService");

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const logs = Array.isArray(req.body)
            ? req.body
            : [req.body];

        const insertedLogs = [];

        for (const log of logs) {
            const {
                zone_id,
                timestamp,
                motion_detected,
                brightness_level,
                current_value,
                voltage,
                power_consumption
            } = log;

            console.log(`\n📥 Processing zone ${zone_id}`);

            const result = await db.query(
                `INSERT INTO sensor_logs
                (
                    zone_id,
                    timestamp,
                    motion_detected,
                    brightness_level,
                    current_value,
                    voltage,
                    power_consumption
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING log_id, timestamp`,
                [
                    zone_id,
                    timestamp,
                    motion_detected,
                    brightness_level,
                    current_value,
                    voltage,
                    power_consumption
                ]
            );

            const logId = result.rows[0].log_id;
            const logTimestamp = result.rows[0].timestamp;

            insertedLogs.push(logId);

            console.log(`✅ Inserted log_id: ${logId}`);

            // anomaly async
            runAnomalyDetection(logId);

            console.log(zone_id, power_consumption, logTimestamp)

            // energy + auto predict
            await updateEnergySummary({
                zone_id,
                power_consumption,
                timestamp: logTimestamp
            });

            console.log(`✅ Zone ${zone_id} completed`);
        };

        console.log("🚀 Sending response...");

        return res.json({
            message: "Data saved successfully",
            total_logs: insertedLogs.length,
            log_ids: insertedLogs
        });

    } catch (err) {
        console.error("❌ Sensor POST error:", err);

        res.status(500).json({
            error: "Server error"
        });
    }
});

module.exports = router;