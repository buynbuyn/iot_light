const express = require("express");
const { predictEnergy } = require("../service/energyService");

const router = express.Router();

// GET /api/energy/predict/:zone_id
router.get("/predict/:zone_id", predictEnergy);

module.exports = router;