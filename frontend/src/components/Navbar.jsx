import React, { useState } from "react";
import '../main.css';

export default function Navbar() {
    const [search, setSearch] = useState("");
    const [ringing, setRinging] = useState(false);

    const handleBell = () => {
        setRinging(true);
        setTimeout(() => setRinging(false), 500);
    };

    return (
        <nav className="navbar">

            {/* ── Search ── */}
            <div className="search-wrap">
                <span className="search-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                </span>
                <input
                    placeholder="Tìm kiếm thiết bị, cảnh báo..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* ── Right ── */}
            <div className="nav-right">

                {/* Bell */}
                <button
                    className={`bell${ringing ? " ringing" : ""}`}
                    onClick={handleBell}
                    title="Thông báo"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    <span className="bell-dot" />
                </button>

                <div className="nav-divider" />

                {/* User */}
                <div className="user-pill">
                    <div className="user-names">
                        <span className="user-name">Admin User</span>
                        <span className="user-role">Quản trị viên</span>
                    </div>
                    <div className="avatar">AU</div>
                </div>

            </div>
        </nav>
    );
}