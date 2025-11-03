import { NextRequest, NextResponse } from 'next/server';
import { forkManager } from '@/lib/forkService';

/**
 * GET /api/fork/status
 * 检测Anvil Fork网络的实际运行状态
 * 
 * 支持多种场景：
 * 1. Docker本地：通过 host.docker.internal:8545
 * 2. 远程服务器：通过 localhost:8545 或环境变量配置的地址
 */
export async function GET(request: NextRequest) {
  try {
    // 获取RPC URL的多个备选方案
    const rpcUrls = [
      // 优先使用环境变量或配置的地址（支持远程服务器）
      process.env.ANVIL_RPC_URL || 'http://localhost:8545',
      // 备选方案1：Docker本地访问
      'http://host.docker.internal:8545',
      // 备选方案2：标准本地访问
      'http://127.0.0.1:8545',
    ];

    let lastError: Error | null = null;
    let isRunning = false;
    let chainId = 0;
    let blockNumber = 0;
    let successfulRpcUrl = '';

    // 尝试每个RPC URL
    for (const rpcUrl of rpcUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(rpcUrl, {
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
          continue;
        }

        const data = await response.json();

        // 如果RPC有效响应，说明Anvil正在运行
        if (data.result) {
          isRunning = true;
          chainId = parseInt(data.result, 16);
          successfulRpcUrl = rpcUrl;

          // 获取更多信息
          try {
            const blockResponse = await fetch(rpcUrl, {
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

          break; // 成功找到可用的RPC，退出循环
        }
      } catch (err) {
        lastError = err as Error;
        continue; // 继续尝试下一个URL
      }
    }

    if (isRunning) {
      return NextResponse.json({
        success: true,
        isRunning: true,
        chainId,
        blockNumber,
        rpcUrl: successfulRpcUrl,
        message: 'Anvil Fork网络运行中',
      });
    }

    return NextResponse.json({
      success: true,
      isRunning: false,
      message: 'Anvil 未运行',
      error: lastError?.message || '无法连接到Anvil',
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