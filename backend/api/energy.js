const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/:zone_id", async (req, res) => {
    const zoneId = req.params.zone_id;

    const result = await pool.query(`
        SELECT * FROM energy_summary
        WHERE zone_id = $1
        ORDER BY month
    `, [zoneId]);

    res.json(result.rows);
});

module.exports = router;