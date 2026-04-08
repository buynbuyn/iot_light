const { Server } = require('socket.io');
const pool = require('../db');

const fetchLatestLogs = async () => {
  const query = `
    SELECT 
      sl.log_id as id,
      z.zone_name as khu_vuc,
      sl.timestamp as thoi_diem,
      sl.current_value as cuong_do,
      sl.voltage as dien_ap,
      sl.brightness_level as do_sang,
      sl.power_consumption as cong_suat,
      CASE WHEN ah.log_id IS NOT NULL THEN true ELSE false END as is_anomaly
    FROM sensor_logs sl
    JOIN zones z ON sl.zone_id = z.zone_id
    LEFT JOIN anomaly_history ah ON sl.log_id = ah.log_id
    WHERE sl.motion_detected = true
    ORDER BY sl.timestamp DESC
  `;
  const res = await pool.query(query);
  return res.rows;
};

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  io.on('connection', async (socket) => {
    try {
      const logs = await fetchLatestLogs();
      socket.emit('initialData', { logs });
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

    socket.on('disconnect', () => {
    });
  });

  return io;
};

module.exports = setupSocket;