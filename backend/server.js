
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { runAnomalyDetection } = require("./service/anomalyService");
const pool = require("./db");
const { Client } = require("pg");

// Routes
const alertRoutes = require("./routes/alertRoutes");
const anomalyHistoryRoutes = require("./routes/anomaly_historyRoutes");
const sensorRoutes = require("./api/sensor");
const energyRoutes = require("./routes/energyRoutes");

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
listener.on("notification", (msg) => {
    const logId = parseInt(msg.payload);
    console.log(`[DB Trigger] New log_id: ${logId}`);
    runAnomalyDetection(logId);
});
listener.on("error", (err) => console.error("[Listener ERROR]", err.message));

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