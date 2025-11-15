const mysql = require('mysql2/promise');

async function cleanupCache() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'webdev123',
    database: process.env.MYSQL_DATABASE || 'web3_trad',
    port: 33061,
  });

  try {
    console.log('Cleaning up old cache entries...');

    // Delete old cache entries for token 2 (keep only the latest)
    const [result] = await connection.execute(
      `DELETE FROM token_pools_cache 
       WHERE token_id = 2 AND chain = 'bsc' 
       AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM token_pools_cache 
           WHERE token_id = 2 AND chain = 'bsc' 
           ORDER BY updated_at DESC 
           LIMIT 1
         ) AS latest
       )`
    );

    console.log(`✅ Cleaned up ${result.affectedRows} old cache entries`);

    // Show remaining cache entries
    const [remaining] = await connection.execute(
      'SELECT token_id, chain, pool_count, updated_at FROM token_pools_cache ORDER BY updated_at DESC'
    );

    console.log('\nRemaining cache entries:');
    remaining.forEach(row => {
      console.log(`  Token ${row.token_id} (${row.chain}): ${row.pool_count} pools, updated: ${row.updated_at}`);
    });

  } catch (error) {
    console.error('❌ Error cleaning up cache:', error);
  } finally {
    await connection.end();
  }
}

cleanupCache().catch(console.error);