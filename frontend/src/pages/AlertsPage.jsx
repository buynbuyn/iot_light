import { useEffect, useState } from "react";
import React from "react";
import "../css/alerts.css";

function AlertPage() {
    const [alerts, setAlerts] = useState([]);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        fetch("http://localhost:5000/api/alerts")
            .then((res) => res.json())
            .then((data) => setAlerts(data));

        fetch("http://localhost:5000/api/anomaly-history")
            .then((res) => res.json())
            .then((data) => setHistory(data));
    }, []);

    return (
        <div className="dashboard-container">
            {/* SIDEBAR BÊN TRÁI: CẢNH BÁO NÓNG */}
            <aside className="alert-sidebar">
                <div className="sidebar-header">
                    <h3>📢 Cảnh báo nóng</h3>
                    <span className="live-tag">LIVE</span>
                </div>

                <div className="alert-cards-container">
                    {alerts.length === 0 ? (
                        <div className="empty-state-mini">Không có cảnh báo mới</div>
                    ) : (
                        alerts.map((a) => (
                            <div key={a.alert_id} className={`alert-card border-${a.severity}`}>
                                <div className="card-top">
                                    <span className="node-id">NODE-{a.alert_id}</span>
                                    <span className="card-time">
                                        {new Date(a.detected_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <h4 className="alert-title">{a.alert_type}</h4>
                                <div className="card-bottom">
                                    <span>📍 {a.zone_id}</span>
                                    <span className={`status-text ${a.severity}`}>● {a.severity}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="ai-info-box">
                    <h5>AI INTELLIGENCE</h5>
                    <p>Hệ thống đang sử dụng mô hình Z - Core & Isolation Forest để phát hiện dữ liệu bất thường.</p>
                    <div className="accuracy-bar">
                        <div className="progress" style={{ width: "88%" }}></div>
                    </div>
                    
                </div>
            </aside>

            {/* NỘI DUNG CHÍNH BÊN PHẢI: LỊCH SỬ */}
            <main className="history-main">
                <div className="main-header">
                    <div>
                        <h2>Lịch sử cảnh báo</h2>
                        <p className="subtitle">Dữ liệu tổng hợp từ anomaly_history</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn-outline">Bộ lọc</button>
                        <button className="btn-primary">Xuất báo cáo</button>
                    </div>
                </div>

                <div className="table-container">
                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>MÃ NODE</th>
                                <th>KHU VỰC</th>
                                <th>LOẠI SỰ CỐ</th>
                                <th>MỨC ĐỘ</th>
                                <th>THỜI GIAN</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((h) => (
                                <tr key={h.anomaly_id}>
                                    <td className="node-cell">NODE-{h.anomaly_id}</td>
                                    <td>{h.zone_id}</td>
                                    <td>
                                        <span className="incident-type">● {h.anomaly_type}</span>
                                    </td>
                                    <td>
                                        <span className={`severity-text ${h.severity}`}>
                                            {h.severity}
                                        </span>
                                    </td>
                                    <td className="time-cell">
                                        {new Date(h.detected_time).toLocaleDateString()} <br />
                                        <small>{new Date(h.detected_time).toLocaleTimeString()}</small>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}

export default AlertPage;