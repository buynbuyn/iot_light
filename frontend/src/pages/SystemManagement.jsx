import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaCity, FaLightbulb, FaEdit, FaTrashAlt, FaPlus, FaSearch } from 'react-icons/fa';
import '../css/system.css';

const SystemManagement = () => {
    const [zones, setZones] = useState([]);
    const [lights, setLights] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Đảm bảo URL này khớp với Port của Backend
                const API_URL = 'http://localhost:5000/api'; 
                
                const [zRes, lRes] = await Promise.all([
                    axios.get(`${API_URL}/zones`),
                    axios.get(`${API_URL}/street-lights`)
                ]);

                setZones(Array.isArray(zRes.data) ? zRes.data : []);
                setLights(Array.isArray(lRes.data) ? lRes.data : []);
            } catch (err) {
                console.error("Lỗi kết nối API:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="system-container">Đang tải dữ liệu hệ thống...</div>;

    return (
        <div className="system-container">
            <h2 className="system-title">Quản lý Hệ thống (Zones & Street Lights)</h2>

            <div className="stats-grid">
                <div className="stat-card blue">
                    <div className="stat-info">
                        <p>Tổng số Khu vực</p>
                        <h3>{zones.length}</h3>
                    </div>
                    <div className="stat-icon"><FaCity /></div>
                </div>
                <div className="stat-card orange">
                    <div className="stat-info">
                        <p>Tổng số Trụ đèn</p>
                        <h3>{lights.length}</h3>
                    </div>
                    <div className="stat-icon"><FaLightbulb /></div>
                </div>
            </div>

            {/* Bảng Zones */}
            <div className="table-wrapper">
                <div className="table-header blue">
                    <span className="font-bold">| Quản lý Khu vực (Zones)</span>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>MÃ KHU VỰC</th>
                            <th>TÊN KHU VỰC</th>
                            <th>LOẠI KHU VỰC</th>
                            <th>CÔNG SUẤT</th>
                            <th>TRẠNG THÁI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {zones.length > 0 ? zones.map(z => (
                            <tr key={z.zone_id}>
                                <td>ZN-{String(z.zone_id).padStart(3, '0')}</td>
                                <td>{z.zone_name}</td>
                                <td>{z.area_type}</td>
                                <td>{z.rated_power} kW</td>
                                <td><span className={`badge-status ${String(z.status).toLowerCase()}`}>{z.status}</span></td>
                            </tr>
                        )) : <tr><td colSpan="5">Không có dữ liệu</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Bảng Street Lights */}
            <div className="table-wrapper">
                <div className="table-header orange">
                    <span className="font-bold">| Quản lý Trụ đèn (Street Lights)</span>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>MÃ ĐÈN</th>
                            <th>MÃ KHU VỰC</th>
                            <th>VỊ TRÍ</th>
                            <th>TRẠNG THÁI</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lights.length > 0 ? lights.map(l => (
                            <tr key={l.light_id}>
                                <td>LT-{l.light_id}</td>
                                <td>ZN-{String(l.zone_id).padStart(3, '0')}</td>
                                <td>Trụ số {l.position_order}</td>
                                <td><span className={`badge-status ${String(l.status).toLowerCase()}`}>{l.status}</span></td>
                            </tr>
                        )) : <tr><td colSpan="4">Không có dữ liệu</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SystemManagement;