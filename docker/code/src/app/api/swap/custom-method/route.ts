import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/swap/custom-method
 * 执行自定义 Swap 方法
 * 
 * 支持用户自由输入任意的 swap 方法名称和参数
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, methodName, params, network = 'fork' } = body;

    // 参数验证
    if (!account || !methodName || !params) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数：account, methodName, params',
        },
        { status: 400 }
      );
    }

    // 验证方法名称格式（应该是 camelCase）
    if (!methodName.match(/^[a-zA-Z][a-zA-Z0-9]*$/)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的方法名称格式。方法名称应以字母开头，只包含字母和数字',
        },
        { status: 400 }
      );
    }

    // 验证参数是否为对象
    if (typeof params !== 'object' || params === null || Array.isArray(params)) {
      return NextResponse.json(
        {
          success: false,
          error: '参数必须是有效的 JSON 对象',
        },
        { status: 400 }
      );
    }

    // 模拟执行自定义方法
    const txHash = `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}`;
    const timestamp = new Date().toISOString();

    // 构建返回对象
    const result = {
      methodName,
      account,
      params,
      network,
      txHash,
      timestamp,
      message: `${methodName} 方法执行成功`,
      // 模拟返回值
      returnValue: {
        outputAmount: '1000000000000000000',
        gasEstimate: '150000',
        priceImpact: '0.5%',
      },
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('执行自定义方法失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '执行自定义方法失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/swap/custom-method/examples
 * 获取常用的自定义 Swap 方法示例
 */
export async function GET(request: NextRequest) {
  const examples = [
    {
      methodName: 'swapV3ExactInputSingle',
      description: 'Uniswap V3 单步交换（精确输入）',
      params: {
        tokenIn: '0x...',
        tokenOut: '0x...',
        fee: '3000',
        amount: '1000000000000000000',
        minAmount: '0',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      },
    },
    {
      methodName: 'swapV3ExactOutputSingle',
      description: 'Uniswap V3 单步交换（精确输出）',
      params: {
        tokenIn: '0x...',
        tokenOut: '0x...',
        fee: '3000',
        amountOut: '1000000000000000000',
        maxAmount: '2000000000000000000',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      },
    },
    {
      methodName: 'flashSwap',
      description: '闪电贷 Swap',
      params: {
        token0: '0x...',
        token1: '0x...',
        amount0: '1000000000000000000',
        amount1: '0',
        data: '0x',
      },
    },
    {
      methodName: 'multiHopSwap',
      description: '多跳交换',
      params: {
        path: ['0x...', '0x...', '0x...'],
        amountIn: '1000000000000000000',
        minAmountOut: '0',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      },
    },
    {
      methodName: 'swapWithCallback',
      description: '带回调的交换',
      params: {
        tokenIn: '0x...',
        tokenOut: '0x...',
        amount: '1000000000000000000',
        minOutput: '0',
        callbackData: '0x',
      },
    },
  ];

  return NextResponse.json({
    success: true,
    data: examples,
  });
}
