import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, Hex } from 'viem';
import { formatBalance } from '@/lib/utils';

/**
 * GET /api/accounts/[address]/balances
 * 获取指定账户的多种代币余额（BNB及ERC20）
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

    const rpcUrl = process.env.ANVIL_RPC_URL || 'http://anvil-api:8545';
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });

    const balances: any[] = [];

    // 1. 获取原生代币（BNB）余额
    try {
      const bnbBalance = await publicClient.getBalance({
        address: address as Hex,
      });

      const bnbFormatted = formatBalance(bnbBalance, 18);
      balances.push({
        symbol: 'BNB',
        name: 'Binance Coin',
        balance: bnbBalance.toString(),
        formatted: bnbFormatted,
        decimals: 18,
        contractAddress: null,
      });
    } catch (err) {
      console.error('获取BNB余额失败:', err);
    }

    // 2. 获取ERC20代币余额（USDT、USDC、BUSD）
    const erc20Tokens = [
      {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0x55d398326f99059fF775485246999027B3197955',
        decimals: 18,
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d',
        decimals: 18,
      },
      {
        symbol: 'BUSD',
        name: 'Binance USD',
        address: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        decimals: 18,
      },
    ];

    for (const token of erc20Tokens) {
      try {
        // 调用balanceOf函数获取ERC20余额
        // balanceOf(address) 返回 uint256
        const balance = await publicClient.readContract({
          address: token.address as Hex,
          abi: [
            {
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }],
            },
          ],
          functionName: 'balanceOf',
          args: [address as Hex],
        });

        const tokenBalance = balance as bigint;
        const formatted = formatBalance(tokenBalance, token.decimals);

        balances.push({
          symbol: token.symbol,
          name: token.name,
          balance: tokenBalance.toString(),
          formatted,
          decimals: token.decimals,
          contractAddress: token.address,
        });
      } catch (err) {
        // 如果查询失败（可能是没有部署），跳过
        console.log(`获取${token.symbol}余额失败:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      data: balances,
    });
  } catch (error) {
    console.error('获取账户余额失败:', error);
    return NextResponse.json(
      { success: false, error: '获取账户余额失败' },
      { status: 500 }
    );
  }
}
