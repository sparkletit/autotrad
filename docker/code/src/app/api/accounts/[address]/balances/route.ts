import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import type { Address, Hex } from 'viem';
import { formatBalance, normalizeAddress } from '@/lib/utils';

/**
 * GET /api/accounts/[address]/balances
 * 获取指定账户的多种代币余额（BNB及ERC20）
 * 
 * 查询参数:
 *   - tokens: 可选，逗号分隔的代币符号列表，如 "BNB,USDT,USDC"。如果不提供，只查询 BNB
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
    let checksumAddress: Address;
    try {
      checksumAddress = normalizeAddress(address);
    } catch (e) {
      return NextResponse.json(
        { success: false, error: '无效的以太坊地址' },
        { status: 400 }
      );
    }

    // 获取查询参数，指定要查询的代币
    const { searchParams } = new URL(request.url);
    const tokensParam = searchParams.get('tokens'); // 例如: "BNB,USDT" 或 "BNB"
    const requestedTokens = tokensParam 
      ? tokensParam.split(',').map(t => t.trim().toUpperCase())
      : ['BNB']; // 默认只查询 BNB

    const rpcUrl = process.env.ANVIL_RPC_URL || 'http://anvil-api:8545';
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });

    const balances: any[] = [];

    // 1. 获取原生代币（BNB）余额（如果请求中包含 BNB）
    if (requestedTokens.includes('BNB')) {
      try {
        const bnbBalance = await publicClient.getBalance({
          address: checksumAddress,
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
    }

    // 2. 获取ERC20代币余额（仅在请求中包含时才查询）
    // 从数据库中读取自定义代币，统一与 /api/custom-tokens 行为
    let erc20Tokens: { symbol: string; name: string; address: string; decimals: number }[] = [];
    try {
      const resp = await fetch('http://localhost:8888/api/custom-tokens');
      const json = await resp.json();
      if (json?.success && Array.isArray(json.data)) {
        erc20Tokens = json.data.map((t: any) => ({
          symbol: String(t.symbol).toUpperCase(),
          name: String(t.symbol).toUpperCase(),
          address: String(t.address),
          decimals: parseInt(String(t.decimals)) || 18,
        }));
      }
    } catch (e) {
      console.warn('读取自定义代币失败，退回硬编码：', e);
      erc20Tokens = [
        {
          symbol: 'USDT',
          name: 'USDT',
          address: '0x55d398326f99059fF775485246999027B3197955',
          decimals: 18,
        },
        {
          symbol: 'USDC',
          name: 'USDC',
          address: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d',
          decimals: 18,
        },
        {
          symbol: 'BUSD',
          name: 'BUSD',
          address: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
          decimals: 18,
        },
      ];
    }

    // 只查询请求中包含的 ERC20 代币
    for (const token of erc20Tokens) {
      if (!requestedTokens.includes(token.symbol)) {
        continue; // 跳过未请求的代币
      }

      try {
        // 调用balanceOf函数获取ERC20余额
        // balanceOf(address) 返回 uint256
        let tokenAddr: Address;
        try {
          tokenAddr = normalizeAddress(token.address);
        } catch (e) {
          continue;
        }
        const balance = await publicClient.readContract({
          address: tokenAddr,
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
          args: [checksumAddress],
        });

        const tokenBalance = balance as bigint;
        const formatted = formatBalance(tokenBalance, token.decimals);

        balances.push({
          symbol: token.symbol,
          name: token.name,
          balance: tokenBalance.toString(),
          formatted,
          decimals: token.decimals,
          contractAddress: tokenAddr,
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
