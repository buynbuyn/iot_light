require("dotenv").config();
const { Pool } = require("pg");
const { predictEnergyForZone } = require("../service/energyService");

// Direct DB connection
const pool = new Pool({
    connectionString: process.env.DATABASE_DIRECT_URL,
    ssl: false
});

async function backfillPrediction() {
    try {
        console.log("⏳ Bắt đầu backfill prediction_history từ energy_summary...");

        // 1. Lấy tất cả zone_id hiện có trong energy_summary
        const zones = await pool.query(`
            SELECT DISTINCT zone_id
            FROM energy_summary
        `);

        console.log("🔹 Zones fetched:", zones.rows.map(z => z.zone_id));

        if (zones.rows.length === 0) {
            console.log("⚠️ Không có zone nào trong energy_summary");
            process.exit(0);
        }

        let count = 0;
        for (const zone of zones.rows) {
            try {
                console.log(`⏳ Đang predict cho zone_id=${zone.zone_id} ...`);

                const result = await predictEnergyForZone(zone.zone_id);

                console.log(`✅ Zone ${zone.zone_id} prediction success: predicted_kwh=${result.predicted_kwh}, predicted_cost=${result.predicted_cost}`);

            } catch (err) {
                console.error(`❌ Zone ${zone.zone_id} predict failed:`, err);
            }
            count++;
            console.log(`📊 Progress: ${count}/${zones.rows.length}`);
        }

        console.log("🎉 Backfill prediction_history xong!");
        process.exit(0);

    } catch (err) {
        console.error("❌ Lỗi backfill prediction:", err);
        process.exit(1);
    }
}

backfillPrediction();