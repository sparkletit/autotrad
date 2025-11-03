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
 * GET /api/address-aliases
 * 获取所有交易池地址
 */
export async function GET(request: NextRequest) {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT id, alias, address, network, type, created_at, updated_at FROM address_aliases WHERE is_active = true ORDER BY created_at DESC'
    );
    await connection.end();

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error('获取交易池地址失败:', error);
    if (connection) await connection.end();
    return NextResponse.json(
      { success: false, error: '获取交易池地址失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/address-aliases
 * 添加新的交易池地址
 */
export async function POST(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();
    const { alias, address, network, type } = body;

    if (!alias || !address || !network || !type) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    connection = await mysql.createConnection(dbConfig);

    // 检查地址和别名是否已存在
    const [existing] = await connection.execute(
      'SELECT id FROM address_aliases WHERE (alias = ? OR address = ?) AND is_active = true',
      [alias, address]
    );

    if ((existing as any[]).length > 0) {
      await connection.end();
      return NextResponse.json(
        { success: false, error: '该别名或地址已存在' },
        { status: 400 }
      );
    }

    // 插入新别名
    const [result] = await connection.execute(
      'INSERT INTO address_aliases (alias, address, network, type) VALUES (?, ?, ?, ?)',
      [alias, address, network, type]
    );

    await connection.end();

    return NextResponse.json({
      success: true,
      message: '交易池地址添加成功',
      id: (result as any).insertId,
    });
  } catch (error) {
    console.error('添加交易池地址失败:', error);
    if (connection) await connection.end();
    return NextResponse.json(
      { success: false, error: '添加交易池地址失败' },
      { status: 500 }
    );
  }
}
