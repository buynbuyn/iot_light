const express = require("express");
const { predictEnergy } = require("../service/energyService");
const { PredictApi } = require("../api/prediction");

const router = express.Router();

// GET /api/energy/predict/:zone_id
router.get("/predict/:zone_id", predictEnergy);
router.get("/", PredictApi.getPredict);

module.exports = router;