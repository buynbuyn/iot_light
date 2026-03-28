const { spawn } = require("child_process");
const path = require("path");

// logIds có thể là 1 số hoặc 1 mảng số
function runAnomalyDetection(logIds) {
    const ids = Array.isArray(logIds) ? logIds : [logIds];
    const idsArg = ids.join(","); // "81,82,83"

    console.log(`[Anomaly] Spawning Python for log_ids: ${idsArg}`);

    const py = spawn("python", [
        path.join(__dirname, "../ml/anomaly_detection.py"),
        idsArg,
    ]);

    py.stdout.on("data", (data) => {
        console.log(`[Anomaly] ${data.toString().trim()}`);
    });

    py.stderr.on("data", (data) => {
        console.error(`[Anomaly ERROR] ${data.toString().trim()}`);
    });

    py.on("close", (code) => {
        console.log(`[Anomaly] Process exited with code ${code}`);
    });
}

module.exports = { runAnomalyDetection };