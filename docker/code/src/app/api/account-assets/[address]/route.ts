import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, Hex } from 'viem';

/**
 * GET /api/account-assets/[address]
 * 获取Fork网络中指定账户的资产信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address: addressParam } = await params;

    if (!addressParam || !addressParam.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { success: false, error: '无效的以太坊地址' },
        { status: 400 }
      );
    }

    // 直接连接到Fork网络的RPC
    const rpcUrl = 'http://host.docker.internal:8545';
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });

    // BNB链资产配置
    const assetsConfig = [
      {
        symbol: 'BNB',
        name: 'Binance Coin',
        decimals: 18,
        contractAddress: null,
      },
      {
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 18,
        contractAddress: '0x55d398326f99059fF775485246999027B3197955',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 18,
        contractAddress: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d',
      },
      {
        symbol: 'BUSD',
        name: 'Binance USD',
        decimals: 18,
        contractAddress: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      },
    ];

    // 获取BNB余额
    const bnbBalance = await publicClient.getBalance({
      address: addressParam as Hex,
    });

    const assets = [
      {
        symbol: 'BNB',
        name: 'Binance Coin',
        balance: bnbBalance.toString(),
        decimals: 18,
        contractAddress: null,
        formatted: (BigInt(bnbBalance) / BigInt(10 ** 18)).toString(),
      },
      // TODO: 添加ERC20余额查询
      // 对于ERC20代币，需要调用balanceOf函数
      {
        symbol: 'USDT',
        name: 'Tether USD',
        balance: '0',
        decimals: 18,
        contractAddress: '0x55d398326f99059fF775485246999027B3197955',
        formatted: '0',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        balance: '0',
        decimals: 18,
        contractAddress: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d',
        formatted: '0',
      },
      {
        symbol: 'BUSD',
        name: 'Binance USD',
        balance: '0',
        decimals: 18,
        contractAddress: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        formatted: '0',
      },
    ];

    return NextResponse.json({
      success: true,
      data: assets,
      message: '获取Fork网络资产信息成功',
    });
  } catch (error) {
    console.error('获取账户资产失败:', error);
    return NextResponse.json(
      { success: false, error: '获取账户资产失败' },
      { status: 500 }
    );
  }
}
