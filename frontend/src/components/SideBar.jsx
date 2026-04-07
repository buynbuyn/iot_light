import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaHome, FaDatabase, FaBell, FaChartBar, FaCog } from "react-icons/fa";
import "../main.css";

const NAV_ITEMS = [
    { id: "overview", icon: <FaHome />, label: "Tổng quan", path: "/" },
    { id: "system", icon: <FaCog />, label: "Quản lý Hệ thống", path: "/system-management" },
    { id: "monitor", icon: <FaDatabase />, label: "Giám sát dữ liệu", path: "/monitor" },
    { id: "alerts", icon: <FaBell />, label: "Cảnh báo & Sự cố", path: "/alerts" },
    { id: "reports", icon: <FaChartBar />, label: "Báo cáo phân tích", path: "/reports" },
];

export default function Sidebar() {
    const [active, setActive] = useState("overview");
    const navigate = useNavigate();

    const handleClick = (e, item) => {
        setActive(item.id);

        // chuyển trang
        navigate(item.path);

        // ripple wave
        const element = e.currentTarget;
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ripple = document.createElement("span");
        ripple.style.cssText = `
      position:absolute;
      width:8px;
      height:8px;
      background:rgba(255,255,255,0.35);
      border-radius:50%;
      left:${x}px;
      top:${y}px;
      z-index:5;
      pointer-events:none;
      transform:translate(-50%,-50%);
      animation:rippleOut 0.6s ease-out forwards;
    `;

        element.appendChild(ripple);
        setTimeout(() => ripple.remove(), 620);
    };

    return (
        <aside className="sidebar">

            {/* Logo */}
            <div className="logo">
                <img
                    style={{
                        padding: "0px 10px 10px 10px",
                        width: "200px",
                        height: "auto",
                        display: "block",
                        objectFit: "contain",
                    }}
                    src="../../img/logo.png"
                    alt="IoT Global Logo"
                />
            </div>

            {/* Nav items */}
            {NAV_ITEMS.map((item) => (
                <div
                    key={item.id}
                    className={`nav-item ${active === item.id ? "active" : ""}`}
                    onClick={(e) => handleClick(e, item)}
                >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                </div>
            ))}

            {/* Footer status */}
            <div className="sidebar-footer">
                <div className="status-row">
                    <div className="status-dot" />
                    <span>Hoạt động ổn định</span>
                </div>
            </div>

        </aside>
    );
}