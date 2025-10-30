import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { Hex } from 'viem';

const getRpcUrl = (network: string): string => {
  const rpcUrls: Record<string, string> = {
    fork: 'http://host.docker.internal:8545',
    ethereum: 'https://mainnet.infura.io/v3/YOUR_KEY',
    bsc: 'https://bsc-dataseed1.bnbchain.org',
    polygon: 'https://polygon-rpc.com',
  };
  return rpcUrls[network] || rpcUrls.fork;
};

/**
 * POST /api/swap
 * 执行代币交换操作
 * 
 * 支持的 Swap 命令：
 * 1. swapExactTokensForTokens - 精确输入，灵活输出
 * 2. swapTokensForExactTokens - 灵活输入，精确输出
 * 3. swapExactETHForTokens - 精确 ETH 输入
 * 4. swapTokensForExactETH - 精确 ETH 输出
 * 5. swapExactTokensForETH - 精确代币输入，ETH 输出
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      account,
      tokenIn,
      tokenOut,
      amount,
      command,
      route,
      pools,
      network = 'fork',
      slippage = 1, // 默认 1% 滑点
    } = body;

    // 参数验证
    if (!account || !amount || !command) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数：account, amount, command',
        },
        { status: 400 }
      );
    }

    // 根据命令检查必要参数
    if (command === 'swapExactETHForTokens' || command === 'swapTokensForExactETH') {
      if (!tokenOut) {
        return NextResponse.json(
          { success: false, error: '缺少参数：tokenOut' },
          { status: 400 }
        );
      }
    } else if (command === 'swapExactTokensForETH') {
      if (!tokenIn) {
        return NextResponse.json(
          { success: false, error: '缺少参数：tokenIn' },
          { status: 400 }
        );
      }
    } else {
      if (!tokenIn || !tokenOut) {
        return NextResponse.json(
          { success: false, error: '缺少必要参数：tokenIn, tokenOut' },
          { status: 400 }
        );
      }
    }

    const rpcUrl = getRpcUrl(network);
    const publicClient = createPublicClient({ transport: http(rpcUrl) });

    // 获取代币信息
    const tokenInDecimals = tokenIn ? await getTokenDecimals(tokenIn, publicClient) : 18;
    const tokenOutDecimals = tokenOut ? await getTokenDecimals(tokenOut, publicClient) : 18;

    // 转换金额为最小单位
    const amountIn = parseUnits(amount, tokenInDecimals);

    // 根据不同的 Swap 命令执行操作
    let result;
    switch (command) {
      case 'swapExactTokensForTokens':
        result = await handleSwapExactTokensForTokens(
          account,
          tokenIn,
          tokenOut,
          amountIn,
          route,
          pools,
          publicClient
        );
        break;

      case 'swapTokensForExactTokens':
        result = await handleSwapTokensForExactTokens(
          account,
          tokenIn,
          tokenOut,
          amountIn,
          route,
          pools,
          publicClient
        );
        break;

      case 'swapExactETHForTokens':
        result = await handleSwapExactETHForTokens(
          account,
          tokenOut,
          amountIn,
          route,
          pools,
          publicClient
        );
        break;

      case 'swapTokensForExactETH':
        result = await handleSwapTokensForExactETH(
          account,
          tokenIn,
          amountIn,
          route,
          pools,
          publicClient
        );
        break;

      case 'swapExactTokensForETH':
        result = await handleSwapExactTokensForETH(
          account,
          tokenIn,
          amountIn,
          route,
          pools,
          publicClient
        );
        break;

      default:
        return NextResponse.json(
          { success: false, error: `不支持的 Swap 命令: ${command}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        tokenInDecimals,
        tokenOutDecimals,
        amountIn: amountIn.toString(),
        slippage,
      },
    });
  } catch (error) {
    console.error('Swap 操作失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Swap 操作失败',
      },
      { status: 500 }
    );
  }
}

/**
 * swapExactTokensForTokens
 * 精确输入，灵活输出
 * 用户知道要花多少代币A买代币B，但不知道具体能买多少
 */
async function handleSwapExactTokensForTokens(
  account: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  route: string,
  pools: string[],
  publicClient: any
) {
  try {
    // 模拟 Uniswap V2 风格的 swap
    // 实际场景需要调用真实的交易所合约
    const currentBalance = await publicClient.getBalance({
      address: account as Hex,
    });

    // 计算预期输出（简化模型，实际需要根据池流动性计算）
    const amountOut = (amountIn * 99n) / 100n; // 99% 的兑换率（1% 费用）

    // 模拟交换操作
    const txHash = `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}`;

    return {
      command: 'swapExactTokensForTokens',
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      amountOut: amountOut.toString(),
      amountOutFormatted: formatUnits(amountOut, 18),
      route,
      pools: pools || [],
      account,
      txHash,
      timestamp: new Date().toISOString(),
      message: `成功交换 ${formatUnits(amountIn, 18)} ${tokenIn} 为 ${formatUnits(amountOut, 18)} ${tokenOut}`,
    };
  } catch (err) {
    throw new Error(`swapExactTokensForTokens 失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * swapTokensForExactTokens
 * 灵活输入，精确输出
 * 用户知道要买多少代币B，但不知道要花多少代币A
 */
async function handleSwapTokensForExactTokens(
  account: string,
  tokenIn: string,
  tokenOut: string,
  amountOut: bigint,
  route: string,
  pools: string[],
  publicClient: any
) {
  try {
    // 反向计算所需的输入金额
    const amountIn = (amountOut * 101n) / 100n; // 需要多 1% 的输入（费用 + 滑点）

    const txHash = `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}`;

    return {
      command: 'swapTokensForExactTokens',
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      amountInFormatted: formatUnits(amountIn, 18),
      amountOut: amountOut.toString(),
      route,
      pools: pools || [],
      account,
      txHash,
      timestamp: new Date().toISOString(),
      message: `需要花费 ${formatUnits(amountIn, 18)} ${tokenIn} 来换取 ${formatUnits(amountOut, 18)} ${tokenOut}`,
    };
  } catch (err) {
    throw new Error(`swapTokensForExactTokens 失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * swapExactETHForTokens
 * 精确 ETH 输入，灵活代币输出
 * 用户知道要花多少 ETH 买代币
 */
async function handleSwapExactETHForTokens(
  account: string,
  tokenOut: string,
  amountInEth: bigint,
  route: string,
  pools: string[],
  publicClient: any
) {
  try {
    // 计算预期代币输出
    const amountOut = (amountInEth * 1000n) / 100n; // 简化比率，实际需要根据池价格计算

    const txHash = `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}`;

    return {
      command: 'swapExactETHForTokens',
      tokenIn: 'ETH',
      tokenOut,
      amountIn: amountInEth.toString(),
      amountInFormatted: formatUnits(amountInEth, 18),
      amountOut: amountOut.toString(),
      amountOutFormatted: formatUnits(amountOut, 18),
      route,
      pools: pools || [],
      account,
      txHash,
      timestamp: new Date().toISOString(),
      message: `成功用 ${formatUnits(amountInEth, 18)} ETH 换取 ${formatUnits(amountOut, 18)} ${tokenOut}`,
    };
  } catch (err) {
    throw new Error(`swapExactETHForTokens 失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * swapTokensForExactETH
 * 灵活代币输入，精确 ETH 输出
 * 用户知道要换多少 ETH，但不知道要花多少代币
 */
async function handleSwapTokensForExactETH(
  account: string,
  tokenIn: string,
  amountOutEth: bigint,
  route: string,
  pools: string[],
  publicClient: any
) {
  try {
    // 反向计算所需的代币输入
    const amountIn = (amountOutEth * 101n) / 100n;

    const txHash = `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}`;

    return {
      command: 'swapTokensForExactETH',
      tokenIn,
      tokenOut: 'ETH',
      amountIn: amountIn.toString(),
      amountInFormatted: formatUnits(amountIn, 18),
      amountOut: amountOutEth.toString(),
      amountOutFormatted: formatUnits(amountOutEth, 18),
      route,
      pools: pools || [],
      account,
      txHash,
      timestamp: new Date().toISOString(),
      message: `需要花费 ${formatUnits(amountIn, 18)} ${tokenIn} 来换取 ${formatUnits(amountOutEth, 18)} ETH`,
    };
  } catch (err) {
    throw new Error(`swapTokensForExactETH 失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * swapExactTokensForETH
 * 精确代币输入，灵活 ETH 输出
 * 用户知道要卖多少代币，但不知道能换多少 ETH
 */
async function handleSwapExactTokensForETH(
  account: string,
  tokenIn: string,
  amountIn: bigint,
  route: string,
  pools: string[],
  publicClient: any
) {
  try {
    // 计算预期 ETH 输出
    const amountOut = (amountIn * 99n) / 100n; // 99% 的兑换率（1% 费用）

    const txHash = `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}`;

    return {
      command: 'swapExactTokensForETH',
      tokenIn,
      tokenOut: 'ETH',
      amountIn: amountIn.toString(),
      amountInFormatted: formatUnits(amountIn, 18),
      amountOut: amountOut.toString(),
      amountOutFormatted: formatUnits(amountOut, 18),
      route,
      pools: pools || [],
      account,
      txHash,
      timestamp: new Date().toISOString(),
      message: `成功交换 ${formatUnits(amountIn, 18)} ${tokenIn} 为 ${formatUnits(amountOut, 18)} ETH`,
    };
  } catch (err) {
    throw new Error(`swapExactTokensForETH 失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * 获取代币的精度（decimals）
 */
async function getTokenDecimals(token: string, publicClient: any): Promise<number> {
  if (token === 'BNB' || token === 'ETH') {
    return 18;
  }

  try {
    // 这是一个简化的实现
    // 实际应用需要调用 ERC20 的 decimals() 函数
    // 或者从数据库中查询代币信息
    return 18; // 默认为 18
  } catch {
    return 18;
  }
}

/**
 * GET /api/swap/quote
 * 获取交换价格预估（可选）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokenIn = searchParams.get('tokenIn');
    const tokenOut = searchParams.get('tokenOut');
    const amount = searchParams.get('amount');
    const network = searchParams.get('network') || 'fork';

    if (!tokenIn || !tokenOut || !amount) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：tokenIn, tokenOut, amount' },
        { status: 400 }
      );
    }

    // 简化的价格估算（实际需要调用真实的价格预言机）
    const estimatedPrice = (parseFloat(amount) * 0.99).toFixed(6); // 99% 兑换率

    return NextResponse.json({
      success: true,
      data: {
        tokenIn,
        tokenOut,
        amount,
        estimatedOutput: estimatedPrice,
        route: '直接交换',
        network,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('获取 Swap 价格失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取价格失败',
      },
      { status: 500 }
    );
  }
}
