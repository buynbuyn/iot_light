// File: socket.js (Đặt ở thư mục gốc backend)
const { Server } = require('socket.io');
const pool = require('../db');

const fetchLatestLogs = async () => {
    const query = `
      SELECT sl.log_id as id, z.zone_name as khu_vuc, sl.timestamp as thoi_diem,
             sl.current_value as cuong_do, sl.voltage as dien_ap,
             sl.brightness_level as do_sang, sl.power_consumption as cong_suat,
             CASE WHEN ah.log_id IS NOT NULL THEN true ELSE false END as is_anomaly
      FROM sensor_logs sl
      JOIN zones z ON sl.zone_id = z.zone_id
      LEFT JOIN anomaly_history ah ON sl.log_id = ah.log_id
      WHERE sl.motion_detected = true
      ORDER BY sl.timestamp DESC LIMIT 10;
    `;
    const res = await pool.query(query);
    return res.rows;
};

const fetchDashboardData = async () => {
    const lightsPromise = pool.query(`SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) as online FROM street_lights`);
    const zonesPromise = pool.query(`SELECT COUNT(DISTINCT zone_id) as active_zones FROM street_lights WHERE status = 'active'`);
    const alertsPromise = pool.query(`SELECT COUNT(*) as new_alerts FROM anomaly_history WHERE detected_time >= NOW() - INTERVAL '24 hours'`);
    const energyPromise = pool.query(`SELECT COALESCE(SUM(total_wh) / 1000, 0) as total_kwh FROM energy_summary`);
    const chartPromise = pool.query(`SELECT TO_CHAR(month, 'MM/YYYY') as name, COALESCE(SUM(total_wh) / 1000, 0) as value FROM energy_summary GROUP BY month ORDER BY month ASC LIMIT 7`);

    const [lightsRes, zonesRes, alertsRes, energyRes, chartRes] = await Promise.all([lightsPromise, zonesPromise, alertsPromise, energyPromise, chartPromise]);

    return {
        devices_online: parseInt(lightsRes.rows[0].online) || 0,
        devices_total: parseInt(lightsRes.rows[0].total) || 0,
        active_zones: parseInt(zonesRes.rows[0].active_zones) || 0,
        alerts: parseInt(alertsRes.rows[0].new_alerts) || 0,
        total_energy: (parseFloat(energyRes.rows[0].total_kwh) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }),
        chartData: chartRes.rows.map(row => ({ name: row.name, value: parseFloat(row.value) }))
    };
};

const setupSocket = (server) => {
    const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

    setInterval(async () => {
        try {
            const logs = await fetchLatestLogs();
            const dashboardData = await fetchDashboardData();
            io.emit('updateData', { logs }); 
            io.emit('updateDashboardData', dashboardData);
        } catch (error) {
            console.error('Lỗi heartbeat 5s:', error);
        }
    }, 5000);

    io.on('connection', async (socket) => {
        try {
            const logs = await fetchLatestLogs();
            const dashboardData = await fetchDashboardData();
            socket.emit('initialData', { logs });
            socket.emit('initialDashboardData', dashboardData);
        } catch (err) {
            console.error('Lỗi khi lấy dữ liệu ban đầu:', err);
        }
        
        socket.on('requestRefresh', async () => {
            try {
                const logs = await fetchLatestLogs();
                socket.emit('updateData', { logs }); 
            } catch (err) {
                console.error('Lỗi khi tự động cập nhật dữ liệu:', err);
            }
        });
    });

    return io;
};

module.exports = { setupSocket, fetchLatestLogs, fetchDashboardData };