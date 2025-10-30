import { NextRequest, NextResponse } from 'next/server';

const ANVIL_RPC_URL = 'http://host.docker.internal:8545';

/**
 * GET /api/fork/status
 * 检测Anvil Fork网络的实际运行状态
 */
export async function GET(request: NextRequest) {
  try {
    // 直接检测RPC端点是否可响应
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(ANVIL_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({
        success: true,
        isRunning: false,
        message: 'Anvil 未运行',
      });
    }

    const data = await response.json();

    // 如果RPC有效响应，说明Anvil正在运行
    if (data.result) {
      // 获取更多信息
      const blockResponse = await fetch(ANVIL_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });

      const blockData = await blockResponse.json();
      const blockNumber = blockData.result ? parseInt(blockData.result, 16) : 0;

      return NextResponse.json({
        success: true,
        isRunning: true,
        chainId: parseInt(data.result, 16),
        blockNumber: blockNumber,
        rpcUrl: ANVIL_RPC_URL,
        message: 'Anvil Fork网络运行中',
      });
    }

    return NextResponse.json({
      success: true,
      isRunning: false,
      message: 'Anvil 未运行',
    });
  } catch (error) {
    console.error('检测Anvil状态失败:', error);
    return NextResponse.json({
      success: true,
      isRunning: false,
      message: 'Anvil 未运行',
      error: error instanceof Error ? error.message : '未知错误',
    });
  }
}