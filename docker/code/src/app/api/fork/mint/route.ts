import { NextRequest, NextResponse } from 'next/server';
import { mintETH, getBalance, getSupportedTokens, getAccountBalances } from '@/lib/mintService';

/**
 * GET /api/fork/mint
 * 获取支持的代币和账户余额
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    const supportedTokens = getSupportedTokens();

    if (address) {
      try {
        const balances = await getAccountBalances(address);
        return NextResponse.json({
          success: true,
          supportedTokens,
          balances,
        });
      } catch (error) {
        console.error('获取余额失败:', error);
        return NextResponse.json({
          success: true,
          supportedTokens,
          balances: [],
          error: '获取余额失败，请确保Fork网络已启动',
        });
      }
    }

    return NextResponse.json({
      success: true,
      supportedTokens,
    });
  } catch (error) {
    console.error('获取代币列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取代币列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fork/mint
 * Mint代币到指定地址
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, amount, token = 'BNB' } = body;

    if (!address || !amount) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: address 或 amount' },
        { status: 400 }
      );
    }

    let txHash: string;

    // 仅支持Mint原生资产（BNB）
    if (token === 'BNB' || token === 'ETH') {
      // BNB是原生资产，使用ETH的Mint方法（两者逻辑相同）
      txHash = await mintETH(address, amount);
    } else {
      // 不支持Mint ERC20代币
      return NextResponse.json(
        { success: false, error: '暂不支持Mint ERC20代币，仅支持Mint BNB' },
        { status: 400 }
      );
    }

    // 获取更新后的余额
    const balance = await getBalance(address);
    const formatted = (BigInt(balance) / BigInt(10 ** 18)).toString();

    return NextResponse.json({
      success: true,
      message: `成功Mint ${amount} ${token} 到 ${address}`,
      txHash,
      balance,
      formatted,
    });
  } catch (error) {
    console.error('Mint失败:', error);
    const errorMessage = error instanceof Error ? error.message : 'Mint失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
