const express = require("express");
const { PredictApi } = require("../api/prediction.js");

const router = express.Router();

router.get("/:id", PredictApi.getPredict);

module.exports = router;