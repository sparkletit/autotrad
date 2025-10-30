import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';

/**
 * GET /api/fork/chain-info?network=fork
 * 获取指定网络的链信息（网络名称、区块号等）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const network = searchParams.get('network') || 'fork';

    // 网络RPC映射
    const networkConfig: { [key: string]: { rpc: string; chainId?: number } } = {
      fork: { rpc: 'http://host.docker.internal:8545' },
      ethereum: { rpc: 'https://mainnet.infura.io/v3/YOUR_KEY', chainId: 1 },
      bsc: { rpc: 'https://bsc-dataseed1.bnbchain.org', chainId: 56 },
      polygon: { rpc: 'https://polygon-rpc.com', chainId: 137 },
    };

    const config = networkConfig[network];
    if (!config) {
      return NextResponse.json(
        { success: false, error: '不支持的网络' },
        { status: 400 }
      );
    }

    const publicClient = createPublicClient({
      transport: http(config.rpc),
    });

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

    return NextResponse.json({
      success: true,
      data: {
        chainId,
        chainName,
        blockNumber: blockNumber.toString(),
        network,
      },
    });
  } catch (error) {
    console.error('获取链信息失败:', error);
    return NextResponse.json(
      { success: false, error: '获取链信息失败' },
      { status: 500 }
    );
  }
}
