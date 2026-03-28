const express = require("express");
const router = express.Router();

const anomalyController = require("../api/anomaly_history");

// GET /api/anomaly_history
router.get("/", anomalyController.getAnomalyHistory);

module.exports = router;