const db = require("../db");
const path = require("path");
const { PythonShell } = require("python-shell");

/**
 * Cập nhật energy_summary từ sensor và tự động dự đoán
 */
async function updateEnergySummary({ zone_id, power_consumption, timestamp }) {
    try {
        const delta_time_hour = 1 / 60; // giả sử sensor gửi 1 phút 1 lần
        const kWh = (power_consumption / 1000) * delta_time_hour;
        const month = timestamp.toISOString().slice(0, 7) + "-01";
        const dateOnly = timestamp.toISOString().slice(0, 10);

        // lấy giá điện áp dụng gần nhất
        const priceResult = await db.query(`
            SELECT price_id, price_per_kwh
            FROM electricity_price
            WHERE effective_date <= $1::date
            ORDER BY effective_date DESC
            LIMIT 1
        `, [dateOnly]);

        const price = priceResult.rows[0] || { price_id: null, price_per_kwh: 0 };
        const total_cost = kWh * price.price_per_kwh;

        // insert/update energy_summary
        await db.query(`
            INSERT INTO energy_summary (zone_id, month, total_kwh, total_cost, price_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (zone_id, month)
            DO UPDATE SET 
                total_kwh = energy_summary.total_kwh + EXCLUDED.total_kwh,
                total_cost = energy_summary.total_cost + EXCLUDED.total_cost,
                price_id = COALESCE(EXCLUDED.price_id, energy_summary.price_id)
        `, [zone_id, month, kWh, total_cost, price.price_id]);

        // ---- TỰ ĐỘNG dự đoán khi energy_summary thay đổi ----
        await predictEnergyForZone(zone_id);

    } catch (err) {
        console.error("Error updating energy_summary:", err);
    }
}

/**
 * Dự đoán kWh tháng tới cho zone_id, lưu prediction_history
 */
async function predictEnergyForZone(zone_id) {
    try {
        // 1. lấy dữ liệu energy_summary
        const energyData = await db.query(`
            SELECT month, total_kwh
            FROM energy_summary
            WHERE zone_id = $1
            ORDER BY month ASC
        `, [zone_id]);
        energyData.rows.forEach(r => r.total_kwh = parseFloat(r.total_kwh) || 0);
        // 2. lấy giá điện hiện tại
        const priceResult = await db.query(`
            SELECT price_id, price_per_kwh
            FROM electricity_price
            ORDER BY effective_date DESC
            LIMIT 1
        `);
        const price = priceResult.rows[0] || { price_id: null, price_per_kwh: 0 };

        // 3. gọi Python script
        const options = {
            mode: "json",
            pythonOptions: ["-u"],
            args: [JSON.stringify(energyData.rows)]
        };

        const scriptPath = path.join(__dirname, "../ml/energyModel.py"); // fix đường dẫn tuyệt đối

        return new Promise((resolve, reject) => {
            PythonShell.run(scriptPath, options, async (err, results) => {
                if (err) {
                    console.error("PythonShell Error:", err);
                    return reject(err);
                }

                if (!results || results.length === 0) {
                    console.error("PythonShell returned empty results");
                    return reject(new Error("Empty Python result"));
                }

                try {
                    const res = results[0];
                    console.log("Python result:", res); // log để debug
                    const predicted_kwh = res.predicted_kwh || 0;
                    const predicted_cost = predicted_kwh * price.price_per_kwh;

                    const target_month = new Date();
                    target_month.setMonth(target_month.getMonth() + 1);

                    await db.query(`
            INSERT INTO prediction_history
            (zone_id, prediction_date, target_month, predicted_kwh, predicted_cost, model_used)
            VALUES ($1, NOW(), $2, $3, $4, $5)
        `, [zone_id, target_month, predicted_kwh, predicted_cost, res.model_used]);

                    resolve({ predicted_kwh, predicted_cost, model_used: res.model_used });
                } catch (e) {
                    reject(e);
                }
            });
        });

    } catch (err) {
        console.error("Error in predictEnergyForZone:", err);
        throw err;
    }
}

/**
 * API handler nếu cần frontend gọi trực tiếp
 */
async function predictEnergy(req, res) {
    const zone_id = req.params.zone_id;
    try {
        const result = await predictEnergyForZone(zone_id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = { updateEnergySummary, predictEnergyForZone, predictEnergy };