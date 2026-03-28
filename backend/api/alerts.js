const pool = require("../db")

exports.getAlerts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM alerts
      ORDER BY detected_time DESC
    `)

    res.json(result.rows)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error" })
  }
}