import { NextRequest, NextResponse } from 'next/server';
import { forkManager } from '@/lib/forkService';

/**
 * GET /api/fork/config
 * 获取可用网络列表和当前Fork配置
 */
export async function GET(request: NextRequest) {
  try {
    const chains = forkManager.getAvailableChains();
    const currentConfig = forkManager.getCurrentConfig();
    const isForking = forkManager.isForking();

    return NextResponse.json({
      success: true,
      chains,
      currentConfig,
      isForking,
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取配置失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fork/config
 * 启动Fork网络
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainKey, blockNumber, forkPort = 8545 } = body;

    if (!chainKey || blockNumber === undefined) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: chainKey 或 blockNumber' },
        { status: 400 }
      );
    }

    const config = await forkManager.startFork(chainKey, blockNumber, forkPort);

    return NextResponse.json({
      success: true,
      message: `Fork网络已启动`,
      config,
    });
  } catch (error) {
    console.error('启动Fork失败:', error);
    const errorMessage = error instanceof Error ? error.message : '启动Fork失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fork/config
 * 停止Fork网络
 */
export async function DELETE(request: NextRequest) {
  try {
    forkManager.stopFork();
    return NextResponse.json({
      success: true,
      message: 'Fork网络已停止',
    });
  } catch (error) {
    console.error('停止Fork失败:', error);
    return NextResponse.json(
      { success: false, error: '停止Fork失败' },
      { status: 500 }
    );
  }
}
