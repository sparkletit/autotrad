const mysql = require('mysql2/promise');

async function verifyTokens() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'webdev123',
    database: process.env.MYSQL_DATABASE || 'web3_trad',
    port: 33061,
  });

  try {
    console.log('验证代币地址...');

    // 获取所有代币
    const [tokens] = await connection.execute(
      'SELECT id, address, chain FROM imported_tokens ORDER BY id'
    );

    console.log('\n代币验证结果:');
    
    // 已知的真实代币地址
    const knownTokens = {
      'bsc': {
        '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82': 'PancakeSwap Token (CAKE)',
        '0x55d398326f99059ff775485246999027b3197955': 'Tether USD (USDT)',
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c': 'Wrapped BNB (WBNB)',
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56': 'BUSD Token',
        '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9': 'BTCB Token'
      }
    };

    tokens.forEach(token => {
      const chainTokens = knownTokens[token.chain] || {};
      const isKnown = chainTokens[token.address.toLowerCase()];
      
      console.log(`\nID ${token.id}: ${token.address}`);
      console.log(`  链: ${token.chain}`);
      
      if (isKnown) {
        console.log(`  ✅ 已知代币: ${isKnown}`);
      } else {
        console.log(`  ❓ 未知代币: 可能是测试代币或新发行代币`);
        
        // 检查地址格式
        const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(token.address);
        console.log(`  地址格式: ${isValidAddress ? '✅ 有效' : '❌ 无效'}`);
        
        // 检查是否为常见测试地址
        const testAddresses = [
          '0x0000000000000000000000000000000000000000',
          '0x1234567890123456789012345678901234567890'
        ];
        
        if (testAddresses.includes(token.address.toLowerCase())) {
          console.log(`  ⚠️  警告: 这是测试地址`);
        }
      }
    });

    console.log('\n=== 为什么查不到交易池？ ===');
    console.log('1. 0x6ca9e317b92c85a20f78a80442dcb76fb7077777 (ID:1) - 未知代币，可能是测试地址');
    console.log('2. 0x8753d86c9e5dde807b00ab3fb1b4f0aa5516b954 (ID:2) - 未知代币，可能是新发行或私有代币');
    console.log('3. 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82 (ID:3) - ✅ CAKE代币，有活跃交易池');

    console.log('\n=== 建议 ===');
    console.log('要测试交易池功能，建议使用以下真实代币地址:');
    console.log('- CAKE: 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82');
    console.log('- USDT: 0x55d398326f99059ff775485246999027b3197955');
    console.log('- WBNB: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await connection.end();
  }
}

verifyTokens().catch(console.error);