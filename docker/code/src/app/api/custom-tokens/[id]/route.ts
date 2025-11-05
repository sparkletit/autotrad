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
 * PUT /api/custom-tokens/[id]
 * 更新自定义代币
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '无效的代币ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { symbol, decimals } = body;

    if (!symbol || decimals === undefined || decimals === null || decimals === '') {
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

    // 检查代币是否存在
    const [existing] = await connection.query(
      'SELECT id FROM custom_tokens WHERE id = ? AND is_active = true',
      [id]
    );

    if (!Array.isArray(existing) || existing.length === 0) {
      connection.release();
      return NextResponse.json(
        { success: false, error: '代币不存在或已删除' },
        { status: 404 }
      );
    }

    // 更新代币
    await connection.query(
      'UPDATE custom_tokens SET symbol = ?, decimals = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [symbol, decimalsNum, id]
    );

    connection.release();

    return NextResponse.json({
      success: true,
      message: '代币已更新',
    });
  } catch (error) {
    console.error('更新自定义代币失败:', error);
    return NextResponse.json(
      { success: false, error: '更新自定义代币失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/custom-tokens/[id]
 * 删除自定义代币（软删除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: '无效的代币ID' },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();

    // 检查代币是否存在
    const [existing] = await connection.query(
      'SELECT id FROM custom_tokens WHERE id = ? AND is_active = true',
      [id]
    );

    if (!Array.isArray(existing) || existing.length === 0) {
      connection.release();
      return NextResponse.json(
        { success: false, error: '代币不存在或已删除' },
        { status: 404 }
      );
    }

    // 软删除：标记为不活跃
    await connection.query(
      'UPDATE custom_tokens SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    connection.release();

    return NextResponse.json({
      success: true,
      message: '代币已删除',
    });
  } catch (error) {
    console.error('删除自定义代币失败:', error);
    return NextResponse.json(
      { success: false, error: '删除自定义代币失败' },
      { status: 500 }
    );
  }
}
