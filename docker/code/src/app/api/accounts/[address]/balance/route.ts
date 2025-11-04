import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, Hex } from 'viem';
import { formatBalance } from '@/lib/apiService';

/**
 * GET /api/accounts/[address]/balance
 * 获取指定账户在当前网络的余额
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { success: false, error: '无效的以太坊地址' },
        { status: 400 }
      );
    }

    const rpcUrl = 'http://host.docker.internal:8545';
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });

    // 获取原生代币（BNB）余额
    const balance = await publicClient.getBalance({
      address: address as Hex,
    });

   const formatted = formatBalance(BigInt(balance), 18);

    return NextResponse.json({
      success: true,
      data: {
        balance: balance.toString(),
        formatted,
        symbol: 'BNB',
      },
    });
  } catch (error) {
    console.error('获取账户余额失败:', error);
    return NextResponse.json(
      { success: false, error: '获取账户余额失败' },
      { status: 500 }
    );
  }
}
