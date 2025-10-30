import { generateMainAccount, getMainAccounts } from '@/lib/walletService';
import { NextRequest, NextResponse } from 'next/server';

// GET - 获取所有主账号
export async function GET() {
  try {
    const accounts = await getMainAccounts();
    return NextResponse.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error('获取主账号失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取主账号失败',
      },
      { status: 500 }
    );
  }
}

// POST - 创建新的主账号
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountName } = body;

    if (!accountName) {
      return NextResponse.json(
        {
          success: false,
          error: '账号名称不能为空',
        },
        { status: 400 }
      );
    }

    const result = await generateMainAccount(accountName);
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('创建主账号失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建主账号失败',
      },
      { status: 500 }
    );
  }
}
