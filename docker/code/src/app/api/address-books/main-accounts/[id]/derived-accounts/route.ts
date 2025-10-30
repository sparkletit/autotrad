import { generateDerivedAccount, getDerivedAccounts } from '@/lib/walletService';
import { NextRequest, NextResponse } from 'next/server';

// GET - 获取派生账号列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mainAccountId = parseInt(id);
    const accounts = await getDerivedAccounts(mainAccountId);
    
    return NextResponse.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error('获取派生账号失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取派生账号失败',
      },
      { status: 500 }
    );
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

    if (!accountName) {
      return NextResponse.json(
        {
          success: false,
          error: '账号名称不能为空',
        },
        { status: 400 }
      );
    }

    if (typeof derivationIndex !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: '派生索引不能为空',
        },
        { status: 400 }
      );
    }

    const result = await generateDerivedAccount(
      mainAccountId,
      derivationIndex,
      accountName
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('创建派生账号失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建派生账号失败',
      },
      { status: 500 }
    );
  }
}