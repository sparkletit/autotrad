import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST - 批量删除派生账号
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mainAccountId = parseInt(id);
    const body = await request.json();
    const { accountIds } = body; // accountIds 是一个数组

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '需要至少选择一个账号',
        },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();
    try {
      // 验证所有账号都属于该主账号
      const placeholders = accountIds.map(() => '?').join(',');
      const [accounts]: any = await connection.execute(
        `SELECT id FROM derived_accounts WHERE id IN (${placeholders}) AND main_account_id = ?`,
        [...accountIds, mainAccountId]
      );

      if (accounts.length !== accountIds.length) {
        return NextResponse.json(
          {
            success: false,
            error: '部分账号不存在或不属于该主账号',
          },
          { status: 400 }
        );
      }

      // 删除所有选中的派生账号
      await connection.execute(
        `DELETE FROM derived_accounts WHERE id IN (${placeholders}) AND main_account_id = ?`,
        [...accountIds, mainAccountId]
      );

      return NextResponse.json({
        success: true,
        message: `已删除 ${accountIds.length} 个派生账号`,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('批量删除派生账号失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '批量删除派生账号失败',
      },
      { status: 500 }
    );
  }
}
