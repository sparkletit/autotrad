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
 * DELETE /api/custom-tokens/[id]
 * 删除自定义代币
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const connection = await pool.getConnection();
    
    // 软删除（设置is_active为false）
    await connection.query(
      'UPDATE custom_tokens SET is_active = false WHERE id = ?',
      [id]
    );

    connection.release();

    return NextResponse.json({
      success: true,
      message: '代币删除成功',
    });
  } catch (error) {
    console.error('删除自定义代币失败:', error);
    return NextResponse.json(
      { success: false, error: '删除自定义代币失败' },
      { status: 500 }
    );
  }
}
