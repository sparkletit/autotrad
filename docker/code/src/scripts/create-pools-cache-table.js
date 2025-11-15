const mysql = require('mysql2/promise');

async function createPoolsCacheTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'webdev123',
    database: process.env.MYSQL_DATABASE || 'web3_trad',
    port: 33061,
  });

  try {
    console.log('Creating token_pools_cache table...');

    // Create the cache table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS token_pools_cache (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token_id INT NOT NULL,
        chain VARCHAR(50) NOT NULL,
        token_address VARCHAR(255) NOT NULL,
        pools_data JSON NOT NULL,
        pool_count INT NOT NULL DEFAULT 0,
        analysis_metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        INDEX idx_token_chain (token_id, chain),
        INDEX idx_expires_at (expires_at)
      )
    `);

    console.log('✅ token_pools_cache table created successfully');

    // Check if the table exists
    const [rows] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'token_pools_cache'
    `, [process.env.MYSQL_DATABASE || 'web3_trad']);

    if (rows[0].count > 0) {
      console.log('✅ Table verified successfully');
    }

  } catch (error) {
    console.error('❌ Error creating table:', error);
  } finally {
    await connection.end();
  }
}

// Run the script
if (require.main === module) {
  createPoolsCacheTable().catch(console.error);
}

module.exports = { createPoolsCacheTable };