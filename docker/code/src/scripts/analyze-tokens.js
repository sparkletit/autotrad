const mysql = require('mysql2/promise');

async function analyzeTokens() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'webdev123',
    database: process.env.MYSQL_DATABASE || 'web3_trad',
    port: 33061,
  });

  try {
    console.log('分析代币交易池情况...');

    // 获取所有代币
    const [tokens] = await connection.execute(
      'SELECT id, address, chain FROM imported_tokens ORDER BY id'
    );

    console.log('\n代币列表和交易池状态:');
    for (const token of tokens) {
      // 检查缓存
      const [cacheRows] = await connection.execute(
        `SELECT pool_count, updated_at 
         FROM token_pools_cache 
         WHERE token_id = ? AND chain = ? 
         ORDER BY updated_at DESC 
         LIMIT 1`,
        [token.id, token.chain]
      );

      if (cacheRows.length > 0) {
        const cache = cacheRows[0];
        console.log(`  ID ${token.id}: ${token.address}`);
        console.log(`    交易池数量: ${cache.pool_count}`);
        console.log(`    最后分析: ${cache.updated_at}`);
        
        if (cache.pool_count === 0) {
          console.log(`    原因: 该代币在主要DEX上没有活跃的交易对`);
        }
      } else {
        console.log(`  ID ${token.id}: ${token.address} - 未分析`);
      }
      console.log('');
    }

    // 提供一些常见的原因分析
    console.log('\n=== 为什么某些代币没有交易池？ ===');
    console.log('1. 新发行代币: 可能还没有在DEX上创建交易对');
    console.log('2. 低流动性: 交易量太小，没有被主要DEX收录');
    console.log('3. 测试代币: 可能是测试网或开发用途的代币');
    console.log('4. 合约问题: 地址可能不是标准的ERC20合约');
    console.log('5. 私有交易: 可能只在特定的DEX或私有池交易');

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await connection.end();
  }
}

analyzeTokens().catch(console.error);