const pool = require("../db.js");
const path = require("path");
const { spawn } = require("child_process");
/**
Cập nhật energy_summary từ sensor và tự động dự đoán
Dùng đơn vị Wh cho hệ nhỏ
 */
async function updateEnergySummary({ zone_id, power_consumption, timestamp }) {
    try {
        const currentTime = new Date(timestamp);
        const month = currentTime.toISOString().slice(0, 7) + "-01";
        const dateOnly = currentTime.toISOString().slice(0, 10);

        // 1) lấy log trước đó cùng zone
        const prevLogResult = await pool.query(`
            SELECT timestamp
            FROM sensor_logs
            WHERE zone_id = $1
              AND timestamp < $2
            ORDER BY timestamp DESC
            LIMIT 1
        `, [zone_id, currentTime]);

        let wh = 0;

        // 2) tính điện năng theo thời gian thực
        if (prevLogResult.rows.length > 0) {
            const prevTime = new Date(prevLogResult.rows[0].timestamp);

            const deltaMs = currentTime - prevTime;
            const deltaHours = deltaMs / (1000 * 60 * 60);

            // Wh = W × h
            wh = power_consumption * deltaHours;

            console.log(
                `⚡ Zone ${zone_id} | Δt=${deltaHours.toFixed(6)}h | Energy=${wh.toFixed(4)} Wh`
            );
        } else {
            console.log(`⚠️ First log zone ${zone_id}, wh = 0`);
        }

        // 3) lấy giá điện
        const priceResult = await pool.query(`
            SELECT price_id, price_per_kwh
            FROM electricity_price
            WHERE effective_date <= $1::date
            ORDER BY effective_date DESC
            LIMIT 1
        `, [dateOnly]);

        const price = priceResult.rows[0] || {
            price_id: null,
            price_per_kwh: 0
        };

        // ⚠️ giá điện vẫn theo kWh → phải chia 1000
        const total_cost = (wh / 1000) * price.price_per_kwh;

        // 4) update energy_summary
        await pool.query(`
            INSERT INTO energy_summary
            (zone_id, month, total_wh, total_cost, price_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (zone_id, month)
            DO UPDATE SET
                total_wh = energy_summary.total_wh + EXCLUDED.total_wh,
                total_cost = energy_summary.total_cost + EXCLUDED.total_cost,
                price_id = COALESCE(EXCLUDED.price_id, energy_summary.price_id)
        `, [
            zone_id,
            month,
            wh,
            total_cost,
            price.price_id
        ]);

        console.log(`✅ Energy summary updated zone ${zone_id}`);

        // 5) auto predict
        await predictEnergyForZone(zone_id);

    } catch (err) {
        console.error("❌ Error updating energy_summary:", err);
    }
}

/**
 * Dự đoán Wh tháng tới
 */
async function predictEnergyForZone(zone_id) {
    try {
        const energyData = await pool.query(`
            SELECT month, total_wh
            FROM energy_summary
            WHERE zone_id = $1
            ORDER BY month ASC
        `, [zone_id]);

        const formattedData = energyData.rows.map((d) => ({
            month: d.month.toISOString().slice(0, 10),
            total_wh: parseFloat(d.total_wh)
        }));

        if (formattedData.length < 2) {
            console.log("⚠️ Not enough data to predict");
            return null;
        }

        const priceResult = await pool.query(`
            SELECT price_id, price_per_kwh
            FROM electricity_price
            ORDER BY effective_date DESC
            LIMIT 1
        `);

        const price = priceResult.rows[0]?.price_per_kwh || 0;

        const scriptPath = path.join(__dirname, "../ml/energyModel.py");

        return new Promise((resolve, reject) => {
            const py = spawn("python", [
                scriptPath,
                JSON.stringify(formattedData)
            ]);

            let output = "";
            let errorOutput = "";

            py.stdout.on("data", (data) => {
                output += data.toString();
            });

            py.stderr.on("data", (data) => {
                errorOutput += data.toString();
            });

            py.on("close", async (code) => {
                if (code !== 0) {
                    console.error("❌ Python exit code:", code);
                    console.error("stderr:", errorOutput);
                    return reject(new Error(errorOutput));
                }

                try {
                    console.log("📦 Raw Python output:", output);

                    const res = JSON.parse(output.trim());

                    const predicted_wh = res.predicted_wh;

                    const predicted_cost =
                        (predicted_wh / 1000) * price;

                    const targetMonthResult = await pool.query(`
                        SELECT ($1::timestamp + interval '1 month')::date AS target_month
                    `, [new Date()]);

                    const target_month = targetMonthResult.rows[0].target_month;

                    // 🔍 kiểm tra tồn tại
                    const existing = await pool.query(`
                        SELECT prediction_id, zone_id, target_month
                        FROM prediction_history
                        WHERE zone_id = $1
                        AND target_month = $2
                        LIMIT 1
                    `, [zone_id, target_month]);

                    if (existing.rows.length > 0) {
                        // ✅ UPDATE
                        await pool.query(`
                            UPDATE prediction_history
                            SET
                                prediction_date = NOW(),
                                predicted_wh = $1,
                                predicted_cost = $2,
                                model_used = $3
                            WHERE zone_id = $4
                            AND target_month = $5
                        `, [
                            predicted_wh,
                            predicted_cost,
                            res.model_used,
                            zone_id,
                            target_month
                        ]);

                        console.log("♻️ Prediction UPDATED");
                    } else {
                        // ✅ INSERT
                        await pool.query(`
                            INSERT INTO prediction_history
                            (
                                zone_id,
                                prediction_date,
                                target_month,
                                predicted_wh,
                                predicted_cost,
                                model_used
                            )
                            VALUES ($1, NOW(), $2, $3, $4, $5)
                        `, [
                            zone_id,
                            target_month,
                            predicted_wh,
                            predicted_cost,
                            res.model_used
                        ]);

                        console.log("🆕 Prediction INSERTED");
                    }

                    resolve({
                        predicted_wh,
                        predicted_cost,
                        model_used: res.model_used
                    });

                } catch (err) {
                    console.error("❌ JSON parse error:", err);
                    reject(err);
                }
            });
        });

    } catch (err) {
        console.error("❌ Error in predictEnergyForZone:", err);
        throw err;
    }
}

/**
 * API handler
 */
async function predictEnergy(req, res) {
    const zone_id = req.params.zone_id;

    try {
        const result = await predictEnergyForZone(zone_id);
        res.json(result);
    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
}

module.exports = {
    updateEnergySummary,
    predictEnergyForZone,
    predictEnergy
};