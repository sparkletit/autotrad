import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// DELETE - 删除主账号（包括关联的派生账号）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mainAccountId = parseInt(id);

    const connection = await pool.getConnection();
    try {
      // 检查主账号是否存在
      const [accounts]: any = await connection.execute(
        'SELECT id FROM main_accounts WHERE id = ?',
        [mainAccountId]
      );

      if (!accounts || accounts.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: '主账号不存在',
          },
          { status: 404 }
        );
      }

      // 删除关联的派生账号
      await connection.execute(
        'DELETE FROM derived_accounts WHERE main_account_id = ?',
        [mainAccountId]
      );

      // 删除主账号
      await connection.execute(
        'DELETE FROM main_accounts WHERE id = ?',
        [mainAccountId]
      );

      return NextResponse.json({
        success: true,
        message: '主账号及其关联的派生账号已删除',
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('删除主账号失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '删除主账号失败',
      },
      { status: 500 }
    );
  }
}
