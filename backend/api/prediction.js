const express = require("express");
const pool = require("../db");
const { predictEnergyForZone } = require("../service/energyService.js");

const PredictApi = {
    async getPredictById(req, res) {
        try {
            const { id } = req.params;
            const zoneId = parseInt(id)
            const result = await predictEnergyForZone(zoneId);
            res.json(result);

            console.log(result)

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Prediction failed" });
        }
    },

    async getPredict(req, res) {
        try {
            const now = new Date();

            const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);

            const formatted =
            vnTime.toISOString()
                .replace("T", " ")
                .replace("Z", "");

            const { rows } = await pool.query(`
                SELECT p.*, 
                    z.*, 
                    e.*,
                    (predicted_wh - total_wh)%100 as deviation,
                    SUM(e.total_wh) as current,
                    SUM(p.predicted_cost) as cost
                FROM prediction_history p
                JOIN zones z ON z.zone_id = p.zone_id
                JOIN energy_summary e ON e.zone_id = z.zone_id 
                    AND DATE_TRUNC('month', e.month) = DATE_TRUNC('month', $1::timestamp)
                WHERE DATE_TRUNC('month', p.prediction_date) = DATE_TRUNC('month', $1::timestamp)
                GROUP BY p.prediction_id, z.zone_id, e.summary_id
            `, [formatted])

            
            if (rows.length > 0) {
                res.status(200).json({
                    data: rows,
                    success: true,
                    message: "Lấy dữ liệu dữ đoán thành công!"
                })
            }
 
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Lỗi server" });
        }
    }
}

module.exports = { PredictApi };