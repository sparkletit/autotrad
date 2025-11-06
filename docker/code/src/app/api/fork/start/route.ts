import { NextRequest, NextResponse } from 'next/server';

// Anvil API 服务地址（在 Docker 网络中通过服务名访问）
const ANVIL_API_URL = process.env.ANVIL_API_URL || 'http://anvil-api:3000';
const ANVIL_RPC_URL = process.env.ANVIL_RPC_URL || 'http://anvil-api:8545';

/**
 * POST /api/fork/start
 * 通过 Anvil API 服务启动 Anvil Fork 网络
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rpcUrl, blockNumber, forkPort = 8545, chainId = 56, loadState } = body;

    // 验证必要参数（加载状态时也需要 fork 原链）
    if (!rpcUrl || blockNumber === undefined) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: rpcUrl 或 blockNumber' },
        { status: 400 }
      );
    }

    console.log(`通过 Anvil API 启动 Fork: Block=${blockNumber}, Chain=${chainId}, LoadState=${loadState || '无'}`);

    // 先检查 Anvil API 服务是否就绪
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
      
      const healthCheck = await fetch(`${ANVIL_API_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!healthCheck.ok) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Anvil API 服务未就绪，请稍候重试。' 
          },
          { status: 503 }
        );
      }
    } catch (healthError: any) {
      if (healthError.name === 'AbortError' || healthError.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Anvil API 服务未就绪，请稍候重试。如果问题持续，请检查 anvil-api 容器是否正在安装 Foundry。' 
          },
          { status: 503 }
        );
      }
      throw healthError;
    }

    // 调用 Anvil API 服务启动 Fork
    let response: Response;
    try {
      response = await fetch(`${ANVIL_API_URL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rpcUrl,
          blockNumber,
          chainId,
          loadState,
        }),
        signal: (() => {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 30000); // 30秒超时
          return controller.signal;
        })()
      });
    } catch (fetchError: any) {
      // 连接错误处理
      if (fetchError.code === 'ECONNREFUSED' || fetchError.message?.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Anvil API 服务未就绪，请稍候重试。如果问题持续，请检查 anvil-api 容器是否正在安装 Foundry。' 
          },
          { status: 503 }
        );
      }
      throw fetchError;
    }

    const result = await response.json();

    if (!response.ok || !result.success) {
      return NextResponse.json(
        { success: false, error: result.error || '启动 Anvil Fork 失败' },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Anvil Fork网络已启动',
      config: {
        ...result.config,
        rpcUrl: ANVIL_RPC_URL, // 返回容器内的 RPC 地址
      },
    });
  } catch (error) {
    console.error('启动 Anvil Fork 失败:', error);
    const errorMessage = error instanceof Error ? error.message : '启动失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
