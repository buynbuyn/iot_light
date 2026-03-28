import { useEffect, useState } from "react"
import React from "react"
import "../css/alerts.css"

function AlertPage() {

    const [alerts, setAlerts] = useState([])
    const [history, setHistory] = useState([])

    useEffect(() => {

        fetch("http://localhost:5000/api/alerts")
            .then(res => res.json())
            .then(data => setAlerts(data))

        fetch("http://localhost:5000/api/anomaly-history")
            .then(res => res.json())
            .then(data => setHistory(data))

    }, [])

    return (

        <div>

            <h2>Phát hiện bất thường</h2>

            <div className="two-tables">

                {/* ALERTS */}
                <div className="table-box">
                    <h3>⚠️ Alerts (Hiện tại)</h3>

                    <table className="alerts-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Khu vực</th>
                                <th>Loại</th>
                                <th>Mức độ</th>
                                <th>Thời gian</th>
                            </tr>
                        </thead>

                        <tbody>

                            {alerts.length === 0 && (
                                <tr>
                                    <td colSpan="5">
                                        <div className="empty-state">
                                            <div className="empty-icon">⚠️</div>
                                            <p>Không có cảnh báo</p>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {alerts.map(a => (
                                <tr key={a.alert_id}>

                                    <td>{a.alert_id}</td>
                                    <td>{a.zone_id}</td>

                                    <td>
                                        <span className="type-tag">
                                            {a.alert_type}
                                        </span>
                                    </td>

                                    <td>
                                        <span className={`severity-pill ${a.severity}`}>
                                            <span className="pill-dot"></span>
                                            {a.severity}
                                        </span>
                                    </td>

                                    <td>
                                        {new Date(a.detected_time).toLocaleString()}
                                    </td>

                                </tr>
                            ))}

                        </tbody>
                    </table>
                </div>

                {/* HISTORY */}
                <div className="table-box">
                    <h3>📜 History</h3>

                    <table className="alerts-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Khu vực</th>
                                <th>Loại</th>
                                <th>Mức độ</th>
                                <th>Thời gian</th>
                            </tr>
                        </thead>

                        <tbody>

                            {history.length === 0 && (
                                <tr>
                                    <td colSpan="5">
                                        <div className="empty-state">
                                            <div className="empty-icon">📭</div>
                                            <p>Không có dữ liệu history</p>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {history.map(h => (
                                <tr key={h.anomaly_id}>

                                    <td>{h.anomaly_id}</td>
                                    <td>{h.zone_id}</td>

                                    <td>
                                        <span className="type-tag">
                                            {h.anomaly_type}
                                        </span>
                                    </td>

                                    <td>
                                        <span className={`severity-pill ${h.severity}`}>
                                            <span className="pill-dot"></span>
                                            {h.severity}
                                        </span>
                                    </td>

                                    <td>
                                        {new Date(h.detected_time).toLocaleString()}
                                    </td>

                                </tr>
                            ))}

                        </tbody>
                    </table>
                </div>

            </div>

        </div>
    )
}

export default AlertPage