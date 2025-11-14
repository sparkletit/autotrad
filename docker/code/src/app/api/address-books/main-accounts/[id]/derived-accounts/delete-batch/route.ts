import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ok, fail } from '@/lib/serverUtils';

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

    if (!Array.isArray(accountIds) || accountIds.length === 0) { return fail('需要至少选择一个账号', 400); }

    const connection = await pool.getConnection();
    try {
      // 验证所有账号都属于该主账号
      const placeholders = accountIds.map(() => '?').join(',');
      const [accounts]: any = await connection.execute(
        `SELECT id FROM derived_accounts WHERE id IN (${placeholders}) AND main_account_id = ?`,
        [...accountIds, mainAccountId]
      );

      if (accounts.length !== accountIds.length) { return fail('部分账号不存在或不属于该主账号', 400); }

      // 删除所有选中的派生账号
      await connection.execute(
        `DELETE FROM derived_accounts WHERE id IN (${placeholders}) AND main_account_id = ?`,
        [...accountIds, mainAccountId]
      );

      return ok({ message: `已删除 ${accountIds.length} 个派生账号` });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('批量删除派生账号失败:', error);
    return fail('批量删除派生账号失败', 500);
  }
}
