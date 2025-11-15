const mysql = require('mysql2/promise');

async function checkTokenInfo() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'webdev123',
    database: process.env.MYSQL_DATABASE || 'web3_trad',
    port: 33061,
  });

  try {
    console.log('检查代币表结构...');

    // 检查表结构
    const [columns] = await connection.execute('DESCRIBE imported_tokens');
    console.log('imported_tokens 表结构:');
    columns.forEach(column => {
      console.log(`  ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // 检查ID为2的代币
    const [rows] = await connection.execute(
      'SELECT id, address, chain, color, notes FROM imported_tokens WHERE id = ?',
      [2]
    );

    if (rows.length > 0) {
      const token = rows[0];
      console.log('\nID 2 的代币信息:');
      console.log(`  地址: ${token.address}`);
      console.log(`  链: ${token.chain}`);
      console.log(`  颜色: ${token.color}`);
      console.log(`  备注: ${token.notes}`);
    } else {
      console.log('未找到ID为2的代币');
    }

    // 检查所有代币
    const [allTokens] = await connection.execute(
      'SELECT id, address, chain FROM imported_tokens ORDER BY id'
    );

    console.log('\n所有代币列表:');
    allTokens.forEach(token => {
      console.log(`  ID ${token.id}: ${token.address} (${token.chain})`);
    });

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await connection.end();
  }
}

checkTokenInfo().catch(console.error);