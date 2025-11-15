const mysql = require('mysql2/promise');

async function addPoolField() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'webdev123',
    database: process.env.MYSQL_DATABASE || 'web3_trad',
    port: 33061,
  });

  try {
    console.log('添加 pool 字段到 imported_tokens 表...');

    // 添加 pool 字段
    await connection.execute(`
      ALTER TABLE imported_tokens 
      ADD COLUMN pool VARCHAR(10) DEFAULT '-'
    `);

    console.log('✅ pool 字段添加成功');

    // 验证字段添加
    const [columns] = await connection.execute('DESCRIBE imported_tokens');
    const hasPoolField = columns.some(column => column.Field === 'pool');
    console.log(`✅ 验证成功: ${hasPoolField ? 'pool 字段已存在' : 'pool 字段添加失败'}`);

  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ pool 字段已存在，无需添加');
    } else {
      console.error('❌ 添加字段失败:', error);
    }
  } finally {
    await connection.end();
  }
}

addPoolField().catch(console.error);