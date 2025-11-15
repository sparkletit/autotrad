const mysql = require('mysql2/promise');

async function checkCache() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'webdev123',
    database: process.env.MYSQL_DATABASE || 'web3_trad',
    port: 33061,
  });

  try {
    console.log('Checking cache data...');

    // Check all cache entries
    const [cacheRows] = await connection.execute('SELECT * FROM token_pools_cache ORDER BY updated_at DESC');
    
    console.log(`Found ${cacheRows.length} cache entries:`);
    cacheRows.forEach((row, index) => {
      console.log(`\nCache Entry ${index + 1}:`);
      console.log(`  Token ID: ${row.token_id}`);
      console.log(`  Chain: ${row.chain}`);
      console.log(`  Token Address: ${row.token_address}`);
      console.log(`  Pool Count: ${row.pool_count}`);
      console.log(`  Created: ${row.created_at}`);
      console.log(`  Updated: ${row.updated_at}`);
      console.log(`  Expires: ${row.expires_at}`);
      
      try {
        const poolsData = JSON.parse(row.pools_data);
        console.log(`  Pools Data Length: ${poolsData.pools?.length || 0}`);
        console.log(`  Summary Total Pools: ${poolsData.summary?.totalPools || 0}`);
      } catch (e) {
        console.log(`  Pools Data: Invalid JSON`);
      }
    });

  } catch (error) {
    console.error('❌ Error checking cache:', error);
  } finally {
    await connection.end();
  }
}

checkCache().catch(console.error);