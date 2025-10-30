import { NextResponse } from 'next/server';

/**
 * GET /api/swap/examples
 * 获取常用的自定义 Swap 方法示例
 * 
 * 支持的 DEX 交换执行案例：
 * 
 * 1. Uniswap V3（以太坦）
 *    - swapV3ExactInputSingle: 单步交换，精确输入、灵活输出
 *    - swapV3ExactOutputSingle: 单步交换，炅活输入、精确输出
 * 
 * 2. PancakeSwap V2 Router（BSC/币安智能链）
 *    - swapExactTokensForTokens: 精确输入→灵活输出
 *    - swapTokensForExactTokens: 炅活输入→精确输出
 *    - swapExactETHForTokens: 用BNB买代币（精确输入）
 *    - swapTokensForExactETH: 用代币换BNB（精确输出）
 *    - swapExactTokensForETH: 用代币换BNB（精确输入）
 *    - swapExactTokensForTokensSupportingFeeOnTransferTokens: 支持手续费代币
 * 
 * 3. PancakeSwap V2 Pair 合约（低级 API）
 *    - swap: 程序化交换方法，直接调用液体对合约
 *         特点: 支持闪电贷批正（flash loan）
 * 
 * 4. 其他特殊交换
 *    - flashSwap: 闪电贷交换
 *    - multiHopSwap: 多跷交换（通过多个中间代币）
 *    - swapWithCallback: 带回调的交换
 */
export async function GET() {
  const examples = [
    {
      methodName: 'swapV3ExactInputSingle',
      description: 'Uniswap V3 单步交换（精确输入）',
      params: {
        tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        tokenOut: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
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
        tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        tokenOut: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
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
        token0: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        token1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        amount0: '1000000000000000000',
        amount1: '0',
        data: '0x',
      },
    },
    {
      methodName: 'multiHopSwap',
      description: '多跳交换',
      params: {
        path: [
          '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        ],
        amountIn: '1000000000000000000',
        minAmountOut: '0',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      },
    },
    {
      methodName: 'swapWithCallback',
      description: '带回调的交换',
      params: {
        tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        tokenOut: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        amount: '1000000000000000000',
        minOutput: '0',
        callbackData: '0x',
      },
    },
    // PancakeSwap V2 方法
    {
      methodName: 'swapExactTokensForTokens',
      description: 'PancakeSwap V2 精确输入 - 交换精确数量的代币A获得代币B',
      exchange: 'PancakeSwap V2',
      params: {
        amountIn: '1000000000000000000',
        amountOutMin: '0',
        path: [
          '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
          '0x55d398326f99059fF775485246999027B3197955', // USDT
        ],
        to: '0x73a56a2e0678bd275fC841191EDfF2f6A724F2b2',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      },
    },
    {
      methodName: 'swapTokensForExactTokens',
      description: 'PancakeSwap V2 精确输出 - 花费代币A获得精确数量的代币B',
      exchange: 'PancakeSwap V2',
      params: {
        amountOut: '1000000000000000000',
        amountInMax: '2000000000000000000',
        path: [
          '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
          '0x55d398326f99059fF775485246999027B3197955', // USDT
        ],
        to: '0x73a56a2e0678bd275fC841191EDfF2f6A724F2b2',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      },
    },
    {
      methodName: 'swapExactETHForTokens',
      description: 'PancakeSwap V2 用精确数量的BNB买代币',
      exchange: 'PancakeSwap V2',
      params: {
        amountOutMin: '0',
        path: [
          '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
          '0x55d398326f99059fF775485246999027B3197955', // USDT
        ],
        to: '0x73a56a2e0678bd275fC841191EDfF2f6A724F2b2',
        deadline: Math.floor(Date.now() / 1000) + 3600,
        value: '1000000000000000000', // BNB 数量（单位：Wei）
      },
    },
    {
      methodName: 'swapTokensForExactETH',
      description: 'PancakeSwap V2 用代币换精确数量的BNB',
      exchange: 'PancakeSwap V2',
      params: {
        amountOut: '1000000000000000000',
        amountInMax: '2000000000000000000',
        path: [
          '0x55d398326f99059fF775485246999027B3197955', // USDT
          '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
        ],
        to: '0x73a56a2e0678bd275fC841191EDfF2f6A724F2b2',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      },
    },
    {
      methodName: 'swapExactTokensForETH',
      description: 'PancakeSwap V2 用精确数量的代币换BNB',
      exchange: 'PancakeSwap V2',
      params: {
        amountIn: '1000000000000000000',
        amountOutMin: '0',
        path: [
          '0x55d398326f99059fF775485246999027B3197955', // USDT
          '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
        ],
        to: '0x73a56a2e0678bd275fC841191EDfF2f6A724F2b2',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      },
    },
    {
      methodName: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
      description: 'PancakeSwap V2 支持手续费代币的交换',
      exchange: 'PancakeSwap V2',
      params: {
        amountIn: '1000000000000000000',
        amountOutMin: '0',
        path: [
          '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
          '0x55d398326f99059fF775485246999027B3197955', // USDT
        ],
        to: '0x73a56a2e0678bd275fC841191EDfF2f6A724F2b2',
        deadline: Math.floor(Date.now() / 1000) + 3600,
      },
      note: '用于有转账手续费的代币，如SAFEMOON、SHIB等'
    },
    // PancakeSwap V2 Pair 底层方法
    {
      methodName: 'swap',
      description: 'PancakeSwap V2 Pair 合约的低级 swap 方法',
      exchange: 'PancakeSwap V2 (Pair)',
      params: {
        amount0Out: '0',
        amount1Out: '1000000000000000000',
        to: '0x73a56a2e0678bd275fC841191EDfF2f6A724F2b2',
        data: '0x',
      },
      note: '低级方法，直接调用 Pair 合约的 swap()。amount0Out 和 amount1Out 中至一个必须 > 0。data 用于闪电贷实现',
    },
  ];

  return NextResponse.json({
    success: true,
    data: examples,
  });
}
