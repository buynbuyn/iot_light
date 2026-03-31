
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const {
    updateEnergySummary
} = require("./service/energyService");
const { runAnomalyDetection } = require("./service/anomalyService");
const pool = require("./db");
const { Client } = require("pg");

// Routes
const alertRoutes = require("./routes/alertRoutes");
const anomalyHistoryRoutes = require("./routes/anomaly_historyRoutes");
const sensorRoutes = require("./api/sensor");
const energyRoutes = require("./routes/energyRoutes");
const predictRoutes = require("./routes/predictRoutes")

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Root
app.get("/", (req, res) => {
    res.send("Server Backend đang chạy cực ngon!");
});

// Dashboard fake data
app.get("/api/dashboard", (req, res) => {
    res.json({
        devices_online: 1240,
        power_consumption: 450,
        alerts: 12,
    });
});

// API routes
app.use("/api/alerts", alertRoutes);
app.use("/api/anomaly-history", anomalyHistoryRoutes);
app.use("/api/sensors", sensorRoutes);
app.use("/api/energy", energyRoutes);
app.use("/api/predict", predictRoutes)

// LISTEN/NOTIFY DB (sensor trigger)
const listener = new Client({ connectionString: process.env.DATABASE_DIRECT_URL });
(async () => {
    try {
        await listener.connect();
        await listener.query("LISTEN notify_new_sensor_log");
        console.log("✅ Listening for new sensor logs...");
    } catch (err) {
        console.error("❌ Listener connect failed:", err.message);
    }
})();
listener.on("notification", async (msg) => {
    try {
        const logId = parseInt(msg.payload);

        console.log(`[DB Trigger] New log_id: ${logId}`);

        // 1. anomaly
        runAnomalyDetection(logId);

        // 2. lấy log mới insert
        const result = await pool.query(
            `
            SELECT zone_id, power_consumption, timestamp
            FROM sensor_logs
            WHERE log_id = $1
            `,
            [logId]
        );

        if (result.rows.length === 0) {
            console.log("❌ Log not found");
            return;
        }

        const log = result.rows[0];

        console.log(`📊 Updating energy summary zone ${log.zone_id}`);

        // 3. update summary + auto predict
        await updateEnergySummary({
            zone_id: log.zone_id,
            power_consumption: log.power_consumption,
            timestamp: log.timestamp
        });

        console.log(`✅ Energy + Prediction updated zone ${log.zone_id}`);

    } catch (err) {
        console.error("❌ Listener process error:", err);
    }
});
// Test kết nối DB
(async () => {
    try {
        const client = await pool.connect();
        client.release();
        console.log("✅ Kết nối DB thành công!");
    } catch (err) {
        console.error("❌ Lỗi kết nối DB:", err);
    }
})();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));