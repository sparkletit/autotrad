const mysql = require('mysql2/promise');

async function checkTables() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'webdev123',
    database: process.env.MYSQL_DATABASE || 'web3_trad',
    port: 33061,
  });

  try {
    console.log('Checking database tables...');

    // Show all tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('Available tables:');
    tables.forEach((table) => {
      console.log(' -', Object.values(table)[0]);
    });

    // Check the structure of the first table that looks like our tokens table
    if (tables.length > 0) {
      const tableName = Object.values(tables[0])[0];
      console.log(`\nStructure of ${tableName}:`);
      const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
      columns.forEach((column) => {
        console.log(` - ${column.Field}: ${column.Type}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking tables:', error);
  } finally {
    await connection.end();
  }
}

checkTables().catch(console.error);