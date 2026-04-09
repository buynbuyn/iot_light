const pool = require('../db'); 

const getAllZones = async () => {
    const res = await pool.query('SELECT zone_id, zone_name, area_type, rated_power, status FROM zones ORDER BY zone_id ASC');
    return res.rows;
};

const getAllStreetLights = async () => {
    const res = await pool.query('SELECT light_id, zone_id, position_order, status FROM street_lights ORDER BY light_id ASC');
    return res.rows;
};

module.exports = { getAllZones, getAllStreetLights };