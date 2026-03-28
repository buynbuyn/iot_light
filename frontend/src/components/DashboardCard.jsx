import React, { useRef } from "react";
import '../main.css';

/**
 * Props:
 *  title       string
 *  value       string | number
 *  unit        string          (optional suffix e.g. "kWh")
 *  sub         string          (optional e.g. "/ 1,500")
 *  badge       string          (optional text e.g. "+5.2%")
 *  badgeType   "green"|"red"|"orange"   default "green"
 *  icon        string          emoji e.g. "📡"
 *  iconColor   "blue"|"yellow"|"red"    default "blue"
 *  progress    number          0-100 (optional)
 *  progressColor string        css gradient override
 *  progressLabel string
 *  alerts      { cao, tb, thap }   (optional — replaces progress)
 */
export default function DashboardCard({
    title,
    value,
    unit,
    sub,
    badge,
    badgeType = "green",
    icon = "📊",
    iconColor = "blue",
    progress,
    progressColor,
    progressLabel,
    alerts,
}) {
    const cardRef = useRef(null);

    /* 3-D tilt on mouse move */
    const handleMouseMove = e => {
        const el = cardRef.current;
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.transition = "transform 0.08s, box-shadow 0.28s, border-color 0.28s";
        el.style.transform = `translateY(-6px) scale(1.01) rotateX(${-y * 5}deg) rotateY(${x * 5}deg)`;
    };

    const handleMouseLeave = () => {
        const el = cardRef.current;
        el.style.transition = "transform 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s, border-color 0.3s";
        el.style.transform = "";
    };

    return (
        <div
            ref={cardRef}
            className="card"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {/* Top row: icon + badge */}
            <div className="card-top">
                <div className={`card-icon ${iconColor}`}>{icon}</div>
                {badge && <span className={`badge ${badgeType}`}>{badge}</span>}
            </div>

            {/* Label + value */}
            <div className="card-label">{title}</div>
            <div className="card-value">
                {value ?? "—"}
                {unit && <span className="unit">{unit}</span>}
                {sub && <span className="sub">{sub}</span>}
            </div>

            {/* Progress bar */}
            {progress !== undefined && (
                <>
                    <div className="progress-track">
                        <div
                            className="progress-fill"
                            style={{
                                width: `${progress}%`,
                                ...(progressColor ? { background: progressColor } : {}),
                            }}
                        />
                    </div>
                    {progressLabel && <div className="progress-label">{progressLabel}</div>}
                </>
            )}

            {/* Alert chips */}
            {alerts && (
                <div className="alert-row">
                    <div className="alert-chip cao">
                        <span className="chip-num">{alerts.cao}</span>CAO
                    </div>
                    <div className="alert-chip tb">
                        <span className="chip-num">{alerts.tb}</span>TB
                    </div>
                    <div className="alert-chip thap">
                        <span className="chip-num">{alerts.thap}</span>THẤP
                    </div>
                </div>
            )}
        </div>
    );
}