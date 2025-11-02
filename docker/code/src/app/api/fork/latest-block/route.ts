import { NextRequest, NextResponse } from 'next/server';
import { forkManager } from '@/lib/forkService';

/**
 * GET /api/fork/latest-block
 * 获取指定网络的最新区块号
 */
export async function GET(request: NextRequest) {
  try {
    const chainKey = request.nextUrl.searchParams.get('chainKey');

    if (!chainKey) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: chainKey' },
        { status: 400 }
      );
    }

    const chainConfig = forkManager.getChainConfig(chainKey);
    if (!chainConfig) {
      return NextResponse.json(
        { success: false, error: `不支持的网络: ${chainKey}` },
        { status: 400 }
      );
    }

    // 调用RPC获取最新区块号
    const response = await fetch(chainConfig.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json(
        { success: false, error: `RPC调用失败: ${data.error.message}` },
        { status: 500 }
      );
    }

    // 将16进制区块号转换为十进制
    const latestBlockNumber = parseInt(data.result, 16);

    return NextResponse.json({
      success: true,
      blockNumber: latestBlockNumber,
      chainKey,
      rpcUrl: chainConfig.rpcUrl,
    });
  } catch (error) {
    console.error('获取最新区块号失败:', error);
    const errorMessage = error instanceof Error ? error.message : '获取最新区块号失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
