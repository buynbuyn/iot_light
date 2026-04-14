import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Lightbulb, Map, AlertTriangle, Zap } from 'lucide-react';
import { io } from "socket.io-client";
import '../css/dashboard.css'; 

const socket = io("http://localhost:5000");

export default function Dashboard() {
    const [data, setData] = useState({
        devices_online: 0,
        devices_total: 0,
        active_zones: 0,
        alerts: 0,
        total_energy: "0",
        chartData: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        socket.on('initialDashboardData', (dashboardData) => {
            setData(dashboardData);
            setLoading(false);
        });

        socket.on('updateDashboardData', (dashboardData) => {
            setData(dashboardData);
        });

        return () => {
            socket.off('initialDashboardData');
            socket.off('updateDashboardData');
        };
    }, []);

    return (
        <main className="dash-main">
            <div className="dash-header">
                <div>
                    <h1>Bảng điều khiển Trung tâm</h1>
                    <p>Giám sát hạ tầng chiếu sáng thành phố thông minh theo thời gian thực.</p>
                </div>
            </div>

            <div className="dash-cards-grid">
                <div className="dash-card border-blue">
                    <div className="card-top">
                        <div className="icon-wrapper blue"><Lightbulb size={20} /></div>
                        <span className="badge green">ONLINE</span>
                    </div>
                    <div className="card-bottom">
                        <h4>TỔNG THIẾT BỊ</h4>
                        <div className="card-value">
                            <span className="big-num">{loading ? "..." : data.devices_online}</span>
                            <span className="sub-num">/{loading ? "..." : data.devices_total}</span>
                        </div>
                    </div>
                </div>

                <div className="dash-card border-yellow">
                    <div className="card-top">
                        <div className="icon-wrapper yellow"><Map size={20} /></div>
                        <span className="badge gray">KHU VỰC</span>
                    </div>
                    <div className="card-bottom">
                        <h4>KHU VỰC HOẠT ĐỘNG</h4>
                        <div className="card-value">
                            <span className="big-num">{loading ? "..." : data.active_zones}</span>
                            <span className="text-sub">Hoạt động</span>
                        </div>
                    </div>
                </div>

                <div className="dash-card border-red">
                    <div className="card-top">
                        <div className="icon-wrapper red"><AlertTriangle size={20} /></div>
                        <span className="badge red">CẤP BÁCH</span>
                    </div>
                    <div className="card-bottom">
                        <h4>CẢNH BÁO MỚI</h4>
                        <div className="card-value">
                            <span className="big-num">{loading ? "..." : String(data.alerts).padStart(2, '0')}</span>
                            <span className="text-sub"> trong 24 giờ qua</span>
                        </div>
                    </div>
                </div>

                <div className="dash-card border-green">
                    <div className="card-top">
                        <div className="icon-wrapper green"><Zap size={20} /></div>
                        <span className="badge green-text">TIẾT KIỆM</span>
                    </div>
                    <div className="card-bottom">
                        <h4>TIÊU THỤ NĂNG LƯỢNG</h4>
                        <div className="card-value">
                            <span className="big-num">{loading ? "..." : data.total_energy}</span>
                            <span className="text-sub">kWh</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="dash-chart-section">
                <div className="chart-header">
                    <div>
                        <h3>Biểu đồ năng lượng tiêu thụ</h3>
                        <p>Theo dõi thông số điện năng theo từng tháng</p>
                    </div>
                </div>
                
                <div className="chart-container" style={{ height: 300, width: '100%', marginTop: '20px' }}>
                    {!loading && data.chartData && (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.chartData} barSize={40}>
                                <Tooltip cursor={{fill: '#f0f0f0'}} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <Bar dataKey="value" fill="#9db6d1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </main>
    );
}