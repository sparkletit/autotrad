import { NextRequest, NextResponse } from 'next/server';

const ANVIL_EXECUTABLE = '/home/xiao/.foundry/bin/anvil';
const ANVIL_RPC_URL = 'http://host.docker.internal:8545';

/**
 * POST /api/fork/start
 * 生成Anvil启动命令供用户在宿主机手动执行
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rpcUrl, blockNumber, forkPort = 8545, chainId = 56 } = body;

    if (!rpcUrl || blockNumber === undefined) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: rpcUrl 或 blockNumber' },
        { status: 400 }
      );
    }

    console.log(`生成Anvil启动命令: Block=${blockNumber}, Chain=${chainId}`);

    // 生成启动命令
    const startCommand = `pkill -f "anvil --fork-url" 2>/dev/null; sleep 1; ${ANVIL_EXECUTABLE} --fork-url "${rpcUrl}" --fork-block-number ${blockNumber} --port ${forkPort} --host 0.0.0.0 --chain-id ${chainId} &`;

    return NextResponse.json({
      success: true,
      message: '请在宿主机执行以下命令启动Anvil',
      command: startCommand,
      config: {
        rpcUrl: ANVIL_RPC_URL,
        blockNumber,
        chainId,
        forkPort,
      },
    });
  } catch (error) {
    console.error('生成启动命令失败:', error);
    const errorMessage = error instanceof Error ? error.message : '生成启动命令失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}