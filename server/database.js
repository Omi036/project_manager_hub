const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });


console.log(process.env.MYSQL_USER)


const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
});

module.exports = pool;
