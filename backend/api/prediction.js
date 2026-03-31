const express = require("express");
const pool = require("../db");
const { predictEnergyForZone } = require("../service/energyService.js");

const PredictApi = {
    async getPredict(req, res) {
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
    }
}

module.exports = { PredictApi };