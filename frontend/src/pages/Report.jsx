import React, { useEffect, useState } from "react";
import "../css/report.css"

export default function ReportPage() {
    const [zones ,setZones] = useState([]);
    const [predict, setPredict] = useState([])
    const [current, setCurrent] = useState([])
    const [error, setError] = useState("");

    useEffect(() => {
        const getFee = async () => {
            try {
                const res = await fetch('http://localhost:5000/api/energy/');

                const data = await res.json();

                if (data.success) {
                    setPredict(data.data)
                    console.log(data)
                }
            } catch (err) {
                console.log(err)
            }
        }
    }, [])
    return (
        <div className="report-containner">
            <div className="report-header">
                <div className="report-nav-left">
                    <h3>PHÂN TÍCH TÀI CHÍNH & TIÊU THỤ</h3>
                    <h1>Dự báo hiệu suất 
                        <br /> 
                        năng lượng đô thị.
                    </h1>
                </div>
                <div className="report-nav-right">
                    <div className="report-right">
                        <div className="line-color1"></div>
                        <div className="report-right-info">
                            <h5>CHI PHÍ HIỆN TẠI</h5>
                        </div>
                    </div>
                    <div className="report-right">
                        <div className="line-color2"></div>
                        <div className="report-right-info">
                            <h5>DỰ BÁO THÁNG TỚI</h5>
                        </div>
                    </div>
                </div>
            </div>
            <div className="report-section">

            </div>
            <div className="report-section">

            </div>
        </div>
    )
}