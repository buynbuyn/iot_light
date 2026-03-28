import React, { useEffect, useState } from "react";
import DashboardCard from "../components/DashboardCard";
import '../main.css';

/* inject ripple keyframe once */
if (!document.getElementById("iot-ripple-style")) {
    const s = document.createElement("style");
    s.id = "iot-ripple-style";
    s.textContent = `
    @keyframes rippleOut {
      to { transform: translate(-50%,-50%) scale(22); opacity: 0; }
    }
  `;
    document.head.appendChild(s);
}

export default function Dashboard() {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("http://localhost:5000/api/dashboard")
            .then(res => res.json())
            .then(json => { setData(json); setLoading(false); })
            .catch(() => {
                /* fallback demo values so UI always renders */
                setData({
                    devices_online: 1240,
                    devices_total: 1500,
                    power_consumption: 450,
                    power_pct: 75,
                    alerts: 12,
                    alerts_cao: 2,
                    alerts_tb: 6,
                    alerts_thap: 4,
                });
                setLoading(false);
            });
    }, []);

    return (
        <main className="main">

            {/* ── Page header ── */}
            <div className="page-header">
                <div>
                    <h1>Tổng quan hệ thống</h1>
                    <p>Theo dõi trạng thái thiết bị và dữ liệu cảm biến thời gian thực.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline">📅 7 ngày qua</button>
                    <button className="btn btn-primary">⬇ Xuất báo cáo</button>
                </div>
            </div>

            {/* ── Stat cards ── */}
            <div className="cards">

                <DashboardCard
                    title="Thiết bị trực tuyến"
                    value={loading ? "…" : (data.devices_online?.toLocaleString() ?? "—")}
                    sub={`/ ${(data.devices_total ?? 1500).toLocaleString()}`}
                    badge="+5.2%"
                    badgeType="green"
                    icon="📡"
                    iconColor="blue"
                    progress={loading ? 0 : Math.round((data.devices_online / (data.devices_total || 1500)) * 100)}
                    progressLabel={loading ? "" : `${Math.round((data.devices_online / (data.devices_total || 1500)) * 100)}% tổng thiết bị`}
                />

                <DashboardCard
                    title="Điện năng tiêu thụ"
                    value={loading ? "…" : data.power_consumption}
                    unit="kWh"
                    badge="-2.1%"
                    badgeType="red"
                    icon="⚡"
                    iconColor="yellow"
                    progress={loading ? 0 : (data.power_pct ?? 75)}
                    progressColor="linear-gradient(90deg,#f59e0b,#fbbf24)"
                    progressLabel={`${data.power_pct ?? 75}% so với tháng trước`}
                />

                <DashboardCard
                    title="Cảnh báo hệ thống"
                    value={loading ? "…" : data.alerts}
                    unit=" mới (24h)"
                    badge="Yêu cầu chú ý"
                    badgeType="orange"
                    icon="⚠️"
                    iconColor="red"
                    alerts={loading ? null : {
                        cao: data.alerts_cao ?? 0,
                        tb: data.alerts_tb ?? 0,
                        thap: data.alerts_thap ?? 0,
                    }}
                />

            </div>

        </main>
    );
}