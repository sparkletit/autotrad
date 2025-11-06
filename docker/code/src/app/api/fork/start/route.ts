import { NextRequest, NextResponse } from 'next/server';

const ANVIL_EXECUTABLE = '~/.foundry/bin/anvil';
const ANVIL_RPC_URL = 'http://host.docker.internal:8545';

/**
 * POST /api/fork/start
 * 生成Anvil启动命令供用户在宿主机手动执行
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

    console.log(`生成Anvil启动命令: Block=${blockNumber}, Chain=${chainId}, LoadState=${loadState || '无'}`);

    // 生成启动命令（始终 fork 原链以保留主网合约）
    // 添加重试和超时参数以提高稳定性
    const startCommand = `pkill -f "anvil --fork-url" 2>/dev/null; sleep 1; ${ANVIL_EXECUTABLE} --fork-url "${rpcUrl}" --fork-block-number ${blockNumber} --gas-limit=30000000 --port ${forkPort} --host 0.0.0.0 --chain-id ${chainId} --timeout 60000 --retries 10 --fork-retry-backoff 5000 --compute-units-per-second 1000 > output.txt 2>&1 & tail -f output.txt`;

    return NextResponse.json({
      success: true,
      message: loadState 
        ? `请在宿主机执行以下命令从状态 "${loadState}" 启动Anvil`
        : '请在宿主机执行以下命令启动Anvil',
      command: startCommand,
      config: {
        rpcUrl: ANVIL_RPC_URL,
        blockNumber,
        chainId,
        forkPort,
        loadState: loadState || null,
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