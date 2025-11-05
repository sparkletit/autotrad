import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, Hex } from 'viem';
import { formatBalance } from '@/lib/utils';

/**
 * GET /api/balance-checker?address=0x...&network=fork&tokens=[{address,symbol}]
 * 查询任意地址的代币余额
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const network = searchParams.get('network') || 'fork';
    const tokensParam = searchParams.get('tokens');

    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { success: false, error: '无效的以太坊地址' },
        { status: 400 }
      );
    }

    const networkConfig: { [key: string]: string } = {
      fork: 'http://host.docker.internal:8545',
      ethereum: 'https://mainnet.infura.io/v3/YOUR_KEY',
      bsc: 'https://bsc-dataseed1.bnbchain.org',
      polygon: 'https://polygon-rpc.com',
    };

    const rpcUrl = networkConfig[network];
    if (!rpcUrl) {
      return NextResponse.json(
        { success: false, error: '不支持的网络' },
        { status: 400 }
      );
    }

    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });

    const balances: any[] = [];

    // 1. 获取原生代币（BNB）余额
    try {
      const nativeBalance = await publicClient.getBalance({
        address: address as Hex,
      });

      const nativeFormatted = formatBalance(nativeBalance, 18);
      balances.push({
        symbol: 'BNB',
        name: 'Binance Coin',
        balance: nativeBalance.toString(),
        formatted: formatBalance(nativeBalance, 18),
        decimals: 18,
        contractAddress: null,
      });
    } catch (err) {
      console.error('获取BNB余额失败:', err);
    }

    // 2. 获取自定义ERC20代币余额
    let customTokenList: any[] = [];
    try {
      if (tokensParam) {
        customTokenList = JSON.parse(tokensParam);
      }
    } catch (err) {
      console.error('解析自定义代币列表失败:', err);
    }

    // 默认代币
    const defaultTokens = [
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

    // 合并默认代币和自定义代币
    const allTokens = [...defaultTokens, ...customTokenList];
    // 去重
    const uniqueTokens = Array.from(
      new Map(
        allTokens.map((t) => [t.address.toLowerCase(), t])
      ).values()
    );

    for (const token of uniqueTokens) {
      try {
        if (!token.address.match(/^0x[a-fA-F0-9]{40}$/)) {
          continue;
        }

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
        const decimals = parseInt(String(token.decimals)) || 18;
        const formatted = formatBalance(tokenBalance, decimals);

        balances.push({
          symbol: token.symbol,
          name: token.name || token.symbol,
          balance: tokenBalance.toString(),
          formatted,
          decimals,
          contractAddress: token.address,
        });
      } catch (err) {
        // 记录详细的错误信息
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.log(`获取${token.symbol}余额失败:`, errorMsg);
        
        // 如果是 Anvil fork 的存储错误，跳过此代币，按接投成丢发的态度处理
        if (errorMsg.includes('storage') || errorMsg.includes('method handler crashed')) {
          console.warn(`[警告] ${token.symbol} 余额查询失败（fork 网络的存储问题），跳过不显示`);
          // 继续处理下一个代币，不中断整个流程
          continue;
        }
        
        // 其他网络错误也不中断流程
        console.error(`[错误] ${token.symbol} 余额查询异常:`, err);
      }
    }

    // 是否有至少一个成功的余额
    const hasAtLeastOneBalance = balances.length > 0;

    return NextResponse.json({
      success: true,
      data: {
        address,
        network,
        balances,
      },
    });
  } catch (error) {
    console.error('查询余额失败:', error);
    return NextResponse.json(
      { success: false, error: '查询余额失败' },
      { status: 500 }
    );
  }
}
