import { NextRequest } from 'next/server';
import { createPublicClient, http, Hex } from 'viem';
import { formatBalance } from '@/lib/utils';
import { getRpcUrl, ok, fail, parseBlockchainError } from '@/lib/serverUtils';

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
      return fail('无效的以太坊地址', 400);
    }

    // 直接连接到Fork网络的RPC
    const rpcUrl = getRpcUrl('fork');
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
      }
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
        formatted: formatBalance(bnbBalance, 18),
      }
    ];

    return ok({ data: assets, message: '获取Fork网络资产信息成功' });
  } catch (error) {
    console.error('获取账户资产失败:', error);
    return fail(parseBlockchainError(error), 500);
  }
}
