import { NextRequest } from 'next/server';
import { createPublicClient, http } from 'viem';
import { getRpcUrl, ok, fail } from '@/lib/serverUtils';

/**
 * GET /api/fork/chain-info?network=fork
 * 获取指定网络的链信息（网络名称、区块号等）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const network = searchParams.get('network') || 'fork';

    const rpc = getRpcUrl(network);

    const publicClient = createPublicClient({ transport: http(rpc) });

    // 获取当前区块号
    const blockNumber = await publicClient.getBlockNumber();

    // 获取链ID
    const chainId = await publicClient.getChainId();

    // 根据chainId确定网络名称
    const chainNameMap: { [key: number]: string } = {
      1: 'Ethereum',
      56: 'BSC',
      137: 'Polygon',
      42161: 'Arbitrum',
      8453: 'Base',
    };

    const chainName = chainNameMap[chainId] || `Unknown (${chainId})`;

    return ok({ chainId, chainName, blockNumber: blockNumber.toString(), network });
  } catch (error) {
    console.error('获取链信息失败:', error);
    return fail('获取链信息失败', 500);
  }
}
