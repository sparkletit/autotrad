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
    const { rpcUrl, blockNumber, forkPort = 8545, chainId = 56 } = body;

    if (!rpcUrl || blockNumber === undefined) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: rpcUrl 或 blockNumber' },
        { status: 400 }
      );
    }

    console.log(`生成Anvil启动命令: Block=${blockNumber}, Chain=${chainId}`);

    // 生成启动命令
    // 添加重试和超时参数以提高稳定性：
    // --timeout: RPC 请求超时时间(毫秒)
    // --retries: RPC 请求失败后重试次数
    // --fork-retry-backoff: 重试之间的退避时间(毫秒)
    // --compute-units-per-second: 限制每秒计算单位，避免触发 RPC 限流
    // 注意：移除了 --no-storage-caching 以减少对 RPC 的请求压力，提高启动成功率
    const startCommand = `pkill -f "anvil --fork-url" 2>/dev/null; sleep 1; ${ANVIL_EXECUTABLE} --fork-url "${rpcUrl}" --fork-block-number ${blockNumber} --gas-limit=30000000 --port ${forkPort} --host 0.0.0.0 --chain-id ${chainId} --timeout 60000 --retries 10 --fork-retry-backoff 5000 --compute-units-per-second 1000 > output.txt 2>&1 & tail -f output.txt`;

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