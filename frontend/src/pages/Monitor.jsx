import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Zap, Sun, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import "../css/monitor.css"; 

const socket = io("http://localhost:5000");

const Monitor = () => {
  const [logs, setLogs] = useState([]);
  const [chartData, setChartData] = useState([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    socket.on('initialData', (data) => {
      setLogs(data.logs);
      
      const recentLogs = [...data.logs].reverse(); 
      const initialChart = recentLogs.map(log => ({
        time: new Date(log.thoi_diem).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit', second:'2-digit'}),
        timestamp: new Date(log.thoi_diem).getTime(),
        power: Number(log.cong_suat),
        brightness: Number(log.do_sang)
      }));
      setChartData(initialChart);
    });

    socket.on('updateData', (data) => {
      setLogs(data.logs);
      setCurrentPage(1);

      setChartData(prevData => {
        const latestLog = data.logs[0];
        const newPoint = {
          time: new Date(latestLog.thoi_diem).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit', second:'2-digit'}),
          timestamp: new Date(latestLog.thoi_diem).getTime(),
          power: Number(latestLog.cong_suat),
          brightness: Number(latestLog.do_sang)
        };

        if (prevData.length > 0 && prevData[prevData.length - 1].timestamp === newPoint.timestamp) {
          return prevData;
        }

        const updatedData = [...prevData, newPoint];
        const currentTime = newPoint.timestamp;
        const oneMinuteAgo = currentTime - 60000;
        
        return updatedData.filter(item => item.timestamp >= oneMinuteAgo);
      });
    });

    const autoRefresh = setInterval(() => {
    console.log("Tự động cập nhật dữ liệu...");
    socket.emit('requestRefresh');
  }, 1000);

    return () => {
    socket.off('initialData');
    socket.off('updateData');
    clearInterval(autoRefresh); 
  };
}, []);

  const handleRefresh = () => {
    socket.emit('requestRefresh');
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return (
      <div className="monitor-time-col">
        <div>{date.toLocaleDateString('vi-VN')}</div>
        <div className="monitor-time-sub">{date.toLocaleTimeString('vi-VN')}</div>
      </div>
    );
  };

  // --- TÍNH TOÁN TRUNG BÌNH 1 PHÚT ---
  const avgBrightness = chartData.length > 0
    ? Math.round(chartData.reduce((sum, item) => sum + item.brightness, 0) / chartData.length)
    : 0;

  const avgPower = chartData.length > 0
    ? (chartData.reduce((sum, item) => sum + item.power, 0) / chartData.length).toFixed(1)
    : 0;

  // --- LOGIC PHÂN TRANG BẢNG ---
  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const indexOfLastLog = currentPage * itemsPerPage;
  const indexOfFirstLog = indexOfLastLog - itemsPerPage;
  const currentLogs = logs.slice(indexOfFirstLog, indexOfLastLog);

  const goToPrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  return (
    <div className="monitor-container">
      <div className="monitor-header">
        <div className="monitor-header-title">
          <h2>Giám sát Dữ liệu Cảm biến</h2>
          <p>Real-time sensor logs monitoring (1-Minute Window)</p>
        </div>
        <div className="monitor-header-actions">
          <button className="monitor-btn-primary" onClick={handleRefresh}>
            <RefreshCw size={16} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      <div className="monitor-dashboard-grid">
        <div className="monitor-card monitor-chart-card">
          <div className="monitor-card-header">
            <div>
              <h3 className="monitor-card-title">CÔNG SUẤT TRUNG BÌNH (1 PHÚT)</h3>
              <div className="monitor-power-value">
                <span className="monitor-number">{avgPower}</span> <span className="monitor-unit">W</span>
              </div>
            </div>
          </div>
          <div className="monitor-chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0052cc" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0052cc" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                <Tooltip />
                <Area type="monotone" dataKey="power" stroke="#0052cc" strokeWidth={2} fillOpacity={1} fill="url(#colorPower)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Stats */}
        <div className="monitor-side-stats">
          <div className="monitor-card monitor-stat-card">
            <div className="monitor-stat-icon-wrapper">
              <div className="monitor-stat-icon monitor-yellow"><Zap size={20}/></div>
              <div className="monitor-status monitor-stable">REALTIME</div>
            </div>
            <div className="monitor-stat-info">
              <h4 className="monitor-card-title">ĐIỆN ÁP HIỆN TẠI</h4>
              {/* Lấy điện áp của bản ghi mới nhất */}
              <div className="monitor-stat-value">{logs[0]?.dien_ap || 0} <span className="monitor-unit">V</span></div>
            </div>
          </div>

          <div className="monitor-card monitor-stat-card">
            <div className="monitor-stat-icon-wrapper">
              <div className="monitor-stat-icon monitor-green"><Sun size={20}/></div>
              <div className="monitor-status monitor-optimized">1 MIN AVG</div>
            </div>
            <div className="monitor-stat-info">
              <h4 className="monitor-card-title">ĐỘ SÁNG TRUNG BÌNH</h4>
              <div className="monitor-stat-value">{avgBrightness} <span className="monitor-unit">Lux</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="monitor-card monitor-table-card">
        <div className="monitor-table-header">
          <h3>Bảng nhật ký cảm biến</h3>
          <div className="monitor-table-tabs">
            <button className="active">Tất cả</button>
            <button>Cảnh báo</button>
            <button>Lỗi</button>
          </div>
        </div>
        
        <div className="monitor-table-responsive">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>KHU VỰC</th>
                <th>THỜI ĐIỂM</th>
                <th>CƯỜNG ĐỘ (A)</th>
                <th>ĐIỆN ÁP (V)</th>
                <th>ĐỘ SÁNG (LUX)</th>
                <th>CÔNG SUẤT (W)</th>
              </tr>
            </thead>
            <tbody>
              {currentLogs.map((log) => (
                <tr key={log.id} className={log.is_anomaly ? "monitor-row-anomaly" : ""}>
                  <td className="monitor-log-id">#{log.id}</td>
                  <td className="monitor-zone-name">{log.khu_vuc}</td>
                  <td>{formatTime(log.thoi_diem)}</td>
                  <td className={log.is_anomaly ? "monitor-text-danger monitor-fw-bold" : ""}>{log.cuong_do}</td>
                  <td>{log.dien_ap}</td>
                  <td>{log.do_sang}</td>
                  <td className={log.is_anomaly ? "monitor-text-danger monitor-fw-bold" : ""}>{log.cong_suat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Thanh điều hướng phân trang */}
        {logs.length > 0 && (
          <div className="monitor-pagination">
            <div className="monitor-page-controls">
              <button 
                onClick={goToPrevPage} 
                disabled={currentPage === 1}
                className="monitor-btn-icon"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="monitor-page-current">
                Trang {currentPage} / {totalPages || 1}
              </span>
              <button 
                onClick={goToNextPage} 
                disabled={currentPage === totalPages || totalPages === 0}
                className="monitor-btn-icon"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Monitor;