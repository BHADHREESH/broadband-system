const mysql = require("mysql2");

const pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST || process.env.MYSQLHOST || "localhost",
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    user: process.env.DB_USER || process.env.MYSQLUSER || "root",
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || "",
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || "broadband_db"
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error("Database connection failed:", err);
    } else {
        console.log("Connected to MySQL");
        connection.release();
    }
});

const db = pool.promise();

db.executeQuery = async (sql, params = []) => {
    const [rows] = await db.query(sql, params);
    return rows;
};

module.exports = db;
