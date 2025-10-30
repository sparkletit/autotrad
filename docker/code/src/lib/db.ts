import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'mysql',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'webdev123',
  database: process.env.MYSQL_DATABASE || 'web3_trad',
  port: 3306, // MySQL容器内部端口
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
