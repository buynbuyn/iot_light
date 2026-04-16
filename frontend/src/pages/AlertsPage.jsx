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
        <div>
            <div className="dashboard-container">
                {/* SIDEBAR BÊN TRÁI */}
                <aside className="alert-sidebar">
                    <div className="sidebar-header">
                        <h3>📢 Cảnh báo nóng</h3>
                        <span className="live-tag">LIVE</span>
                    </div>

                    {/* 1. Danh sách cảnh báo (Nằm trên) */}
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
                </aside>

                {/* NỘI DUNG CHÍNH BÊN PHẢI */}
                <main className="history-main">
                    <div className="main-header">
                        <div>
                            <h2>Lịch sử cảnh báo</h2>
                            <p className="subtitle">Lưu trữ từ bộ lọc phát hiện bất thường AI</p>
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
                                        <td><span className="incident-type">● {h.anomaly_type}</span></td>
                                        <td><span className={`severity-text ${h.severity}`}>{h.severity}</span></td>
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
            <div className="ai-report-section">
                <div className="ai-header">
                    <h5>📊 AI LEARNING REPORT</h5>
                    <span className="model-version">v2.4</span>
                </div>

                <div className="model-plot-wrapper">
                    <img
                        src="../../public/analysis_chart.png"
                        alt="AI Accuracy Graph"
                        className="model-plot-img"
                    />
                </div>
            </div>
        </div>
    );
}

export default AlertPage;