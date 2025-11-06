import { NextRequest, NextResponse } from 'next/server';

// Anvil API 服务地址（在 Docker 网络中通过服务名访问）
const ANVIL_API_URL = process.env.ANVIL_API_URL || 'http://anvil-api:3000';
const ANVIL_RPC_URL = process.env.ANVIL_RPC_URL || 'http://anvil-api:8545';

/**
 * GET /api/fork/status
 * 检测Anvil Fork网络的实际运行状态
 * 
 * 优先通过 Anvil API 服务获取状态，如果失败则直接连接 RPC
 */
export async function GET(request: NextRequest) {
  try {
    // 优先通过 Anvil API 服务获取状态
    try {
      const apiResponse = await fetch(`${ANVIL_API_URL}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (apiResponse.ok) {
        const apiResult = await apiResponse.json();
        if (apiResult.success && apiResult.isRunning) {
          return NextResponse.json({
            success: true,
            isRunning: true,
            chainId: apiResult.chainId,
            blockNumber: apiResult.blockNumber,
            rpcUrl: ANVIL_RPC_URL,
            config: apiResult.config,
            message: 'Anvil Fork网络运行中',
          });
        } else if (apiResult.success) {
          return NextResponse.json({
            success: true,
            isRunning: false,
            message: 'Anvil Fork网络未运行',
          });
        }
      }
    } catch (err) {
      console.warn('通过 Anvil API 获取状态失败，尝试直接连接 RPC:', err);
    }

    // 备选方案：直接连接 RPC 检查
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

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

      if (response.ok) {
        const data = await response.json();

        if (data.result) {
          const chainId = parseInt(data.result, 16);
          let blockNumber = 0;

          // 获取区块号
          try {
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
            blockNumber = blockData.result ? parseInt(blockData.result, 16) : 0;
          } catch (err) {
            console.warn('获取区块号失败:', err);
          }

          return NextResponse.json({
            success: true,
            isRunning: true,
            chainId,
            blockNumber,
            rpcUrl: ANVIL_RPC_URL,
            message: 'Anvil Fork网络运行中',
          });
        }
      }
    } catch (err) {
      console.warn('直接连接 RPC 失败:', err);
    }

    return NextResponse.json({
      success: true,
      isRunning: false,
      message: 'Anvil Fork网络未运行',
    });
  } catch (error) {
    console.error('检测Anvil状态失败:', error);
    return NextResponse.json({
      success: true,
      isRunning: false,
      message: 'Anvil Fork网络未运行',
      error: error instanceof Error ? error.message : '未知错误',
    });
  }
}
