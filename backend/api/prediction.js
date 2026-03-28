const express = require("express");
const router = express.Router();
const { runPrediction } = require("../service/predictionService");

// GET /api/predictions/1
router.get("/:zone_id", async (req, res) => {
    try {
        const zoneId = req.params.zone_id;

        const result = await runPrediction(zoneId);

        res.json(result);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Prediction failed" });
    }
});

module.exports = router;