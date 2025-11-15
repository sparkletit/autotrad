const mysql = require('mysql2/promise');

async function debugCacheStorage() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'webdev123',
    database: process.env.MYSQL_DATABASE || 'web3_trad',
    port: 33061,
  });

  try {
    console.log('Debugging cache storage...');

    // Test JSON storage directly
    const testData = {
      pools: [],
      summary: {
        totalPools: 0,
        chains: [],
        dexes: [],
        averagePrice: 0
      }
    };

    const testJson = JSON.stringify(testData);
    console.log('Test JSON:', testJson);
    console.log('Test JSON type:', typeof testJson);
    console.log('Test JSON length:', testJson.length);

    // Insert test data
    await connection.execute(
      `INSERT INTO token_pools_cache (token_id, chain, token_address, pools_data, pool_count, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [999, 'test', '0x123', testJson, 0, new Date(Date.now() + 3600000)]
    );

    console.log('✅ Test data inserted successfully');

    // Check what was stored
    const [rows] = await connection.execute(
      'SELECT pools_data FROM token_pools_cache WHERE token_id = 999'
    );

    if (rows.length > 0) {
      console.log('Stored data:', rows[0].pools_data);
      console.log('Stored data type:', typeof rows[0].pools_data);
      
      try {
        const parsed = JSON.parse(rows[0].pools_data);
        console.log('Parsed successfully:', parsed);
      } catch (e) {
        console.log('Parse error:', e.message);
      }
    }

    // Clean up test data
    await connection.execute('DELETE FROM token_pools_cache WHERE token_id = 999');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

debugCacheStorage().catch(console.error);