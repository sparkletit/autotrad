import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'mysql',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'webdev123',
  database: process.env.MYSQL_DATABASE || 'web3_trad',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * GET /api/custom-tokens
 * 获取所有自定义代币
 */
export async function GET() {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT id, symbol, contract_address as address, decimals FROM custom_tokens WHERE is_active = true ORDER BY created_at ASC'
    );
    connection.release();

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error('获取自定义代币失败:', error);
    return NextResponse.json(
      { success: false, error: '获取自定义代币失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/custom-tokens
 * 添加自定义代币
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, address, decimals } = body;

    if (!symbol || !address || decimals === undefined || decimals === null || decimals === '') {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const decimalsNum = parseInt(String(decimals));
    if (isNaN(decimalsNum) || decimalsNum < 0 || decimalsNum > 255) {
      return NextResponse.json(
        { success: false, error: '精度必须是0-255之间的整数' },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();

    // 检查是否已存在活跃的代币
    const [existing] = await connection.query(
      'SELECT id FROM custom_tokens WHERE contract_address = ? AND is_active = true',
      [address]
    );

    if (Array.isArray(existing) && existing.length > 0) {
      connection.release();
      return NextResponse.json(
        { success: false, error: '该代币地址已存在' },
        { status: 400 }
      );
    }

    // 检查是否存在已删除的同地址代币，如果存在则更新，否则插入新代币
    const [deletedRecord] = await connection.query(
      'SELECT id FROM custom_tokens WHERE contract_address = ? AND is_active = false',
      [address]
    );

    if (Array.isArray(deletedRecord) && deletedRecord.length > 0) {
      // 更新已删除的记录
      await connection.query(
        'UPDATE custom_tokens SET symbol = ?, decimals = ?, is_active = true, updated_at = CURRENT_TIMESTAMP WHERE contract_address = ?',
        [symbol, decimalsNum, address]
      );
    } else {
      // 插入新代币
      await connection.query(
        'INSERT INTO custom_tokens (symbol, contract_address, decimals, network) VALUES (?, ?, ?, ?)',
        [symbol, address, decimalsNum, 'all']
      );
    }

    connection.release();

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        address,
        decimals: decimalsNum,
      },
    });
  } catch (error) {
    console.error('添加自定义代币失败:', error);
    return NextResponse.json(
      { success: false, error: '添加自定义代币失败' },
      { status: 500 }
    );
  }
}
