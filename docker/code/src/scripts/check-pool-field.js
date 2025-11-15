const mysql = require('mysql2/promise');

async function checkPoolField() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'webdev123',
    database: process.env.MYSQL_DATABASE || 'web3_trad',
    port: 33061,
  });

  try {
    console.log('检查 imported_tokens 表结构...');

    // 检查表结构
    const [columns] = await connection.execute('DESCRIBE imported_tokens');
    console.log('字段列表:');
    columns.forEach(column => {
      console.log(`  ${column.Field}: ${column.Type}`);
    });

    // 检查是否有 pool 字段
    const hasPoolField = columns.some(column => column.Field === 'pool');
    console.log(`\n是否有 pool 字段: ${hasPoolField}`);

    if (!hasPoolField) {
      console.log('建议: 需要添加 pool 字段来存储交易池数量');
    }

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await connection.end();
  }
}

checkPoolField().catch(console.error);