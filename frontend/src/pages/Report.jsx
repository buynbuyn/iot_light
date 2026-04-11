import React, { useEffect, useState, useRef } from "react";
import "../css/report.css";


export default function ReportPage() {
  const [predict, setPredict] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const getPredict = async () => {
      const res = await fetch('http://localhost:5000/api/energy/');
      const data = await res.json();
      if (data.success) setPredict(data.data);
    };
    getPredict();
    setTimeout(() => setLoaded(true), 100);
  }, []);

  const totalCurrent = predict.reduce((s, i) => s + Number(i.current_price), 0);
  const totalPredicted = predict.reduce((s, i) => s + Number(i.predicted_cost), 0);
  const delta = (((totalPredicted - totalCurrent) / totalCurrent) * 100).toFixed(1);
  

  return (
    <div className={`rp-root${loaded ? " rp-loaded" : ""}`}>
      {/* Header */}
      <header className="rp-header">
        <div className="rp-header-left">
          <p className="rp-eyebrow">PHÂN TÍCH TÀI CHÍNH &amp; TIÊU THỤ</p>
          <h1 className="rp-title">
            Dự báo hiệu suất
            <br />
            năng lượng đô thị.
          </h1>
        </div>

        <div className="rp-header-right">
          <div className="rp-stat rp-stat--blue">
            <div className="rp-stat-accent rp-stat-accent--blue" />
            <div>
              <p className="rp-stat-label">
                <span className="rp-stat-icon">💰</span> CHI PHÍ HIỆN TẠI
              </p>
              <p className="rp-stat-value">
                {totalCurrent.toLocaleString("vi-VN").split(".").slice(0, 2).join(".")}
              </p>
            </div>
          </div>

          <div className="rp-stat rp-stat--gold">
            <div className="rp-stat-accent rp-stat-accent--gold" />
            <div>
              <p className="rp-stat-label">
                <span className="rp-stat-icon">📈</span> DỰ BÁO THÁNG TỚI
              </p>
              <p className="rp-stat-value">
                {totalPredicted.toLocaleString("vi-VN").split(".").slice(0, 2).join(".")}
              </p>
              <p className="rp-stat-delta rp-stat-delta--up">
                ▲ +{delta}% (Dự báo AI)
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Zone Table */}
      <section className="rp-section rp-animate" style={{ "--delay": "0.1s" }}>
        <div className="rp-section-head">
          <h2 className="rp-section-title">So sánh hiệu suất Khu vực</h2>
          <p className="rp-section-sub">
            Dữ liệu tổng hợp từ 3 trọng điểm đô thị
          </p>
        </div>

        <table className="rp-table">
          <thead>
            <tr>
              <th>KHU VỰC QUẢN LÝ</th>
              <th>TIÊU THỤ (KWH)</th>
              <th>HIỆN TẠI</th>
              <th>DỰ BÁO (KWH)</th>
              <th>DỰ BÁO</th>
              <th>ĐỘ LỆCH (%)</th>
            </tr>
          </thead>
          <tbody>
            {predict.map((row, i) => (
              <tr key={i} className="rp-table-row" style={{ "--row-delay": `${i * 0.08}s` }}>
                <td>
                  <div className="rp-zone-cell">
                    <span
                      className="rp-zone-icon"
                      style={{ background: row.color + "22", color: row.color }}
                    >
                      {row.icon}
                    </span>
                    <div>
                      <strong>{row.zone_name}</strong>
                      <small>{row.zone_sub}</small>
                    </div>
                  </div>
                </td>
                <td>{Number(row.total_wh).toFixed(3).split(".")[0] /1000}</td>
                <td className="rp-bold">{Number(row.current_price).toLocaleString("vi-VN").split(".").slice(0, 2).join(".")}</td>
                <td>{Number(row.predicted_wh).toFixed(3).split(".")[0] /1000}</td>
                <td className="rp-bold rp-gold">{Number(row.predicted_cost).toLocaleString("vi-VN").split(".").slice(0, 2).join(".")}</td>
                <td>
                  <span
                    className={`rp-badge ${
                      row.deviation > 0 ? "rp-badge--neg" : "rp-badge--pos"
                    }`}
                  >
                    {row.deviation > 0 ? "+" : "-"}
                    {Math.abs(row.deviation).toString().slice(0, 2)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Bar Chart */}
      <section className="rp-section rp-animate" style={{ "--delay": "0.25s" }}>
        <div className="rp-section-head rp-chart-head">
          <div>
            <h2 className="rp-section-title">Biểu đồ tiền điện theo tháng</h2>
            <p className="rp-section-sub">
              So sánh giữa tiền điện thực tế (Thực thu) và tiền điện dự báo (Dự kiến)
            </p>
          </div>
          <div className="rp-legend">
            <span className="rp-legend-dot rp-legend-dot--actual" /> Thực tế
            <span className="rp-legend-dot rp-legend-dot--pred" /> Dự báo
          </div>
        </div>
        <div className="rp-chart">
          {predict.map((row, i) => {
            const max = Math.max(
              ...predict.map(r => Math.max(Number(r.current_price), Number(r.predicted_cost)))
            );

            const actualHeight = (Number(row.current_price) / max) * 100;
            const predictedHeight = (Number(row.predicted_cost) / max) * 100;

            return (
              <div className="rp-bar-group" key={i}>
                <div className="rp-bars">
                  <div
                    className="rp-bar rp-bar--actual"
                    style={{ height: `${actualHeight}%` }}
                  />
                  <div
                    className="rp-bar rp-bar--pred"
                    style={{ height: `${predictedHeight}%` }}
                  />
                </div>

                <p className="rp-bar-label">{row.zone_name}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rp-section rp-animate" style={{ "--delay": "0.25s" }}>
          <img style={{height: "400px", width: "900px"}} src="./energy_forecast.png" />
      </section>

    </div>
  );
}