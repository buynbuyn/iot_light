const express = require("express");
const { PredictApi } = require("../api/prediction.js");

const router = express.Router();

router.get("/:id", PredictApi.getPredictById);

module.exports = router;