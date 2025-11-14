import { generateMainAccount, getMainAccounts } from '@/lib/walletService';
import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/serverUtils';

// GET - 获取所有主账号
export async function GET() {
  try {
    const accounts = await getMainAccounts();
    return ok(accounts);
  } catch (error) {
    console.error('获取主账号失败:', error);
    return fail('获取主账号失败', 500);
  }
}

// POST - 创建新的主账号
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountName } = body;

    if (!accountName) { return fail('账号名称不能为空', 400); }

    const result = await generateMainAccount(accountName);
    
    return ok(result);
  } catch (error) {
    console.error('创建主账号失败:', error);
    return fail('创建主账号失败', 500);
  }
}
