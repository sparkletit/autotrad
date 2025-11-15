const mysql = require('mysql2/promise');

async function verifySpecificToken() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'webdev123',
    database: process.env.MYSQL_DATABASE || 'web3_trad',
    port: 33061,
  });

  try {
    console.log('验证特定代币 0x6ca9e317b92c85a20f78a80442dcb76fb7077777...');

    // 检查这个代币的详细信息
    const [rows] = await connection.execute(
      'SELECT * FROM imported_tokens WHERE address = ?',
      ['0x6ca9e317b92c85a20f78a80442dcb76fb7077777']
    );

    if (rows.length > 0) {
      const token = rows[0];
      console.log('代币信息:');
      console.log(`  ID: ${token.id}`);
      console.log(`  地址: ${token.address}`);
      console.log(`  链: ${token.chain}`);
      console.log(`  颜色: ${token.color}`);
      console.log(`  备注: ${token.notes}`);
      console.log(`  交易池: ${token.pool}`);
      console.log(`  创建时间: ${token.created_at}`);
      console.log(`  更新时间: ${token.updated_at}`);
    } else {
      console.log('未找到该地址的代币');
    }

    // 检查是否有相关的缓存数据
    const [cacheRows] = await connection.execute(
      'SELECT * FROM token_pools_cache WHERE token_address = ? ORDER BY updated_at DESC',
      ['0x6ca9e317b92c85a20f78a80442dcb76fb7077777']
    );

    console.log(`\n缓存数据: ${cacheRows.length} 条记录`);
    cacheRows.forEach((cache, index) => {
      console.log(`\n  缓存记录 ${index + 1}:`);
      console.log(`    链: ${cache.chain}`);
      console.log(`    交易池数量: ${cache.pool_count}`);
      console.log(`    过期时间: ${cache.expires_at}`);
      console.log(`    更新时间: ${cache.updated_at}`);
      
      try {
        const poolsData = typeof cache.pools_data === 'string' ? JSON.parse(cache.pools_data) : cache.pools_data;
        console.log(`    交易池详情: ${poolsData.pools?.length || 0} 个`);
        if (poolsData.pools && poolsData.pools.length > 0) {
          poolsData.pools.forEach((pool, i) => {
            console.log(`      ${i + 1}. ${pool.dex} - ${pool.token0Symbol}/${pool.token1Symbol} - $${pool.usdtPrice?.toFixed(6)}`);
          });
        }
      } catch (e) {
        console.log(`    解析错误: ${e.message}`);
      }
    });

    console.log('\n=== 用户提供的交易池信息 ===');
    console.log('用户提到该代币的交易池地址是: 0x13ef62d14bc340b25bea5df98d022adde2e40896');
    console.log('这可能意味着:');
    console.log('1. 该代币确实存在交易池，但不在我们查询的主要DEX中');
    console.log('2. 交易池可能在其他链上，或者使用了不同的DEX协议');
    console.log('3. 可能需要扩展DEX查询范围');

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await connection.end();
  }
}

verifySpecificToken().catch(console.error);