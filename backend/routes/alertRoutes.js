const express = require("express")
const router = express.Router()

const alertController = require("../api/alerts")

router.get("/", alertController.getAlerts)

module.exports = router