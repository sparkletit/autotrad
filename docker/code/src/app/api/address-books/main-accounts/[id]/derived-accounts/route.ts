import { generateDerivedAccount, getDerivedAccounts } from '@/lib/walletService';
import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/serverUtils';

// GET - 获取派生账号列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mainAccountId = parseInt(id);
    const accounts = await getDerivedAccounts(mainAccountId);
    
    return ok(accounts);
  } catch (error) {
    console.error('获取派生账号失败:', error);
    return fail('获取派生账号失败', 500);
  }
}

// POST - 创建派生账号
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { accountName, derivationIndex } = body;
    const mainAccountId = parseInt(id);

    if (!accountName) { return fail('账号名称不能为空', 400); }

    if (typeof derivationIndex !== 'number') { return fail('派生索引不能为空', 400); }

    const result = await generateDerivedAccount(
      mainAccountId,
      derivationIndex,
      accountName
    );

    return ok(result);
  } catch (error) {
    console.error('创建派生账号失败:', error);
    return fail('创建派生账号失败', 500);
  }
}
