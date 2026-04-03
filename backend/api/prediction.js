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
            const date = new Date().toISOString();

            console.log(date)

            const { rows } = await pool.query(`
                SELECT * 
                FROM prediction_history 
                WHERE prediction_date = $1
            `, [date])

            console.log(rows)
            
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