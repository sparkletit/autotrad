import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'mysql',
  port: 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'webdev123',
  database: process.env.MYSQL_DATABASE || 'web3_trad',
};

/**
 * GET /api/accounts/all
 * 获取所有账户（主账号和派生账号）
 */
export async function GET(request: NextRequest) {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // 获取所有主账号
    const [mainAccounts] = await connection.execute(
      'SELECT id, account_name, address FROM main_accounts ORDER BY id'
    );

    // 获取所有派生账号
    const [derivedAccounts] = await connection.execute(
      'SELECT id, account_name, address, derivation_path, main_account_id FROM derived_accounts ORDER BY main_account_id, index_num'
    );

    await connection.end();

    // 组织数据结构
    const accounts = [];

    // 添加主账号
    for (const account of mainAccounts as any[]) {
      accounts.push({
        id: account.id,
        account_name: account.account_name,
        address: account.address,
        type: 'main',
      });
    }

    // 添加派生账号
    for (const account of derivedAccounts as any[]) {
      accounts.push({
        id: account.id,
        account_name: account.account_name,
        address: account.address,
        type: 'derived',
        derivation_path: account.derivation_path,
        main_account_id: account.main_account_id,
      });
    }

    return NextResponse.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error('获取账户列表失败:', error);
    if (connection) await connection.end();
    return NextResponse.json(
      { success: false, error: '获取账户列表失败' },
      { status: 500 }
    );
  }
}
