const express = require("express");
const http = require("http");
const cors = require("cors");
require("dotenv").config();
const { moveExpiredAlerts } = require("./cron/movealerts");
const { updateEnergySummary } = require("./service/energyService");
const { runAnomalyDetection } = require("./service/anomalyService");
const pool = require("./db");
const { Client } = require("pg");

const alertRoutes = require("./routes/alertRoutes");
const anomalyHistoryRoutes = require("./routes/anomaly_historyRoutes");
const sensorRoutes = require("./api/sensor");
const energyRoutes = require("./routes/energyRoutes");
const predictRoutes = require("./routes/predictRoutes")
const iotRoutes = require("./routes/iotRoutes");
const { setupSocket, fetchLatestLogs, fetchDashboardData } = require('./routes/socketRoutes');
const app = express();
const server = http.createServer(app);
const io = setupSocket(server);

// Middleware
app.use(cors());
app.use(express.json());

// Root
app.get("/", (req, res) => {
    res.send("Server Backend đang chạy cực ngon trên port 5000!");
});

// API routes
app.use("/api/alerts", alertRoutes);
app.use("/api/anomaly-history", anomalyHistoryRoutes);
app.use("/api/sensors", sensorRoutes);
app.use("/api/energy", energyRoutes);
app.use("/api/predict", predictRoutes)
app.use("/api", iotRoutes);

// LISTEN/NOTIFY DB (Trigger)
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
        console.log(`🔔 Nhận dữ liệu khu vực mới - Log ID: ${logId}`);

        // QUAN TRỌNG: Phải có await để Python xử lý xong từng khu một
        await runAnomalyDetection(logId);

        // Các bước sau giữ nguyên nhưng nên bọc trong check tồn tại
        const result = await pool.query(
            `SELECT zone_id, power_consumption, timestamp FROM sensor_logs WHERE log_id = $1`,
            [logId]
        );

        if (result.rows.length > 0) {
            const log = result.rows[0];
            await updateEnergySummary({
                zone_id: log.zone_id,
                power_consumption: log.power_consumption,
                timestamp: log.timestamp
            });
            console.log(`✅ Đã cập nhật Energy Summary cho Khu: ${log.zone_id}`);
        }

        // Chỉ emit socket sau khi đã xử lý xong dữ liệu
        if (io) {
            const dashboardData = await fetchDashboardData();
            io.emit('updateDashboardData', dashboardData);
        }

    } catch (err) {
        console.error("❌ Lỗi xử lý khu vực:", err);
    }
});

// Test DB
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
server.listen(PORT, () => console.log(`Server chạy song song API & Socket trên port ${PORT}`));