import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseUnits, formatUnits } from 'viem';
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

// Pair ABI
const PAIR_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'getReserves',
    outputs: [
      { internalType: 'uint112', name: '_reserve0', type: 'uint112' },
      { internalType: 'uint112', name: '_reserve1', type: 'uint112' },
      { internalType: 'uint32', name: '_blockTimestampLast', type: 'uint32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'token0',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'token1',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ERC20 ABI
const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
] as const;

/**
 * 计算 amountOut（基于 x * y = k 公式）
 */
function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn <= BigInt(0)) throw new Error('输入数量必须大于 0');
  if (reserveIn <= BigInt(0) || reserveOut <= BigInt(0)) throw new Error('储备不足');

  const amountInWithFee = amountIn * BigInt(997);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * BigInt(1000) + amountInWithFee;
  return numerator / denominator;
}

/**
 * POST /api/swap/execute
 * 在链上真实执行 Swap 交易
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      account,
      pairAddress,
      tokenIn,
      tokenOut,
      amountIn,
      gasLimit = 'auto',
      slippage = '0.5',
      network = 'fork',
    } = body;

    if (!account || !pairAddress || !tokenIn || !tokenOut || !amountIn) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const rpcUrl = getRpcUrl(network);
    const publicClient = createPublicClient({ transport: http(rpcUrl) });

    console.log('========== Swap 交易开始 ==========');
    console.log('账户:', account);
    console.log('Pair 地址:', pairAddress);
    console.log('输入代币:', tokenIn);
    console.log('输出代币:', tokenOut);
    console.log('输入数量:', amountIn);

    // 获取 Pair 信息
    const token0 = await publicClient.readContract({
      address: pairAddress as Hex,
      abi: PAIR_ABI,
      functionName: 'token0',
    }) as string;

    const token1 = await publicClient.readContract({
      address: pairAddress as Hex,
      abi: PAIR_ABI,
      functionName: 'token1',
    }) as string;

    const reserves = await publicClient.readContract({
      address: pairAddress as Hex,
      abi: PAIR_ABI,
      functionName: 'getReserves',
    });

    const [reserve0, reserve1] = reserves as [bigint, bigint, number];

    console.log('Pair 信息:');
    console.log('- Token0:', token0, '储备:', reserve0.toString());
    console.log('- Token1:', token1, '储备:', reserve1.toString());

    // 确定输入输出顺序
    const isToken0In = tokenIn.toLowerCase() === token0.toLowerCase();
    const reserveIn = isToken0In ? reserve0 : reserve1;
    const reserveOut = isToken0In ? reserve1 : reserve0;

    // 获取代币精度
    let decimalsIn = 18;
    if (tokenIn !== '0x0000000000000000000000000000000000000000') {
      decimalsIn = await publicClient.readContract({
        address: tokenIn as Hex,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }) as number;
    }

    let decimalsOut = 18;
    if (tokenOut !== '0x0000000000000000000000000000000000000000') {
      decimalsOut = await publicClient.readContract({
        address: tokenOut as Hex,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }) as number;
    }

    // 转换输入数量
    const amountInWei = parseUnits(amountIn, decimalsIn);
    console.log('输入数量 (Wei):', amountInWei.toString());

    // 计算输出数量
    const amountOutWei = getAmountOut(amountInWei, reserveIn, reserveOut);
    console.log('计算输出数量 (Wei):', amountOutWei.toString());

    // 应用滑点
    // auto = 0（接受任何数量），其他为用户指定的百分比
    const slippageNum = slippage === 'auto' ? 0 : parseFloat(slippage);
    const amountOutMin = slippageNum === 0 
      ? BigInt(0) // auto 模式：接受任何输出数量
      : (amountOutWei * BigInt(Math.floor((100 - slippageNum) * 100))) / BigInt(10000);
    
    console.log('最小输出 (含滑点):', amountOutMin.toString());
    if (slippageNum === 0) {
      console.log('滑点模式: AUTO (接受任何数量)');
    } else {
      console.log('滑点设置:', `${slippageNum}%`);
    }

    // 如果是 ERC20，先转账到 Pair
    let transferGasUsed = '0x30000'; // 默认 196608 gas
    if (tokenIn !== '0x0000000000000000000000000000000000000000') {
      console.log('转账代币到 Pair...');
      
      const transferData = `0xa9059cbb${pairAddress.slice(2).padStart(64, '0')}${amountInWei.toString(16).padStart(64, '0')}`;
      
      // 如果 gas 是 auto，先预估
      let actualGas = '0x30000';
      if (gasLimit === 'auto') {
        try {
          const estimatedGas = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_estimateGas',
              params: [{
                from: account,
                to: tokenIn,
                data: transferData,
              }],
              id: 1,
            }),
          });
          const gasResult = await estimatedGas.json();
          if (gasResult.result) {
            const estimated = BigInt(gasResult.result);
            const gasWithBuffer = (estimated * BigInt(120)) / BigInt(100); // 预估值 * 1.2
            actualGas = `0x${gasWithBuffer.toString(16)}`;
            console.log('转账 Gas 预估:', estimated.toString());
            console.log('转账 Gas 实际 (预估*1.2):', gasWithBuffer.toString());
          }
        } catch (estimateError) {
          console.warn('Gas 预估失败，使用默认值:', estimateError);
        }
      } else {
        actualGas = `0x${parseInt(gasLimit).toString(16)}`;
      }
      
      transferGasUsed = actualGas;
      
      const transferTx = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_sendTransaction',
          params: [{
            from: account,
            to: tokenIn,
            data: transferData,
            gas: transferGasUsed,
          }],
          id: 1,
        }),
      });

      const transferResult = await transferTx.json();
      if (transferResult.error) {
        throw new Error(`转账失败: ${transferResult.error.message}`);
      }

      console.log('转账交易:', transferResult.result);
      
      const transferReceipt = await publicClient.waitForTransactionReceipt({ 
        hash: transferResult.result as Hex, 
        timeout: 30000 
      });
      
      if (transferReceipt.status !== 'success') {
        throw new Error('代币转账失败（已被 revert）');
      }
      
      console.log('转账确认成功');
    }

    // 调用 Pair 的 swap() 方法
    // 注意：swap() 需要的是实际输出数量，不是最小输出
    // 但是 Uniswap V2 会在内部检查 K 值，所以我们使用计算的输出数量
    const amount0Out = isToken0In ? '0' : amountOutWei.toString();
    const amount1Out = isToken0In ? amountOutWei.toString() : '0';

    console.log('执行 Swap:');
    console.log('- amount0Out:', amount0Out);
    console.log('- amount1Out:', amount1Out);
    console.log('- 最小输出保护 (amountOutMin):', amountOutMin.toString());

    const swapData = `0x022c0d9f${
      BigInt(amount0Out).toString(16).padStart(64, '0')}${
      BigInt(amount1Out).toString(16).padStart(64, '0')}${
      account.slice(2).padStart(64, '0')}${
      '80'.padStart(64, '0')}${'00'.padStart(64, '0')}`;

    // 如果 gas 是 auto，先预估 swap 的 gas
    let swapGasUsed = '0x50000'; // 默认 327680 gas
    if (gasLimit === 'auto') {
      try {
        const estimatedGas = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_estimateGas',
            params: [{
              from: account,
              to: pairAddress,
              data: swapData,
            }],
            id: 1,
          }),
        });
        const gasResult = await estimatedGas.json();
        if (gasResult.result) {
          const estimated = BigInt(gasResult.result);
          const gasWithBuffer = (estimated * BigInt(120)) / BigInt(100); // 预估值 * 1.2
          swapGasUsed = `0x${gasWithBuffer.toString(16)}`;
          console.log('Swap Gas 预估:', estimated.toString());
          console.log('Swap Gas 实际 (预估*1.2):', gasWithBuffer.toString());
        }
      } catch (estimateError) {
        console.warn('Gas 预估失败，使用默认值:', estimateError);
      }
    } else {
      swapGasUsed = `0x${parseInt(gasLimit).toString(16)}`;
    }

    const swapTx = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_sendTransaction',
        params: [{
          from: account,
          to: pairAddress,
          data: swapData,
          gas: swapGasUsed,
        }],
        id: 1,
      }),
    });

    const swapResult = await swapTx.json();
    
    if (swapResult.error) {
      throw new Error(`Swap 失败: ${swapResult.error.message}`);
    }

    const txHash = swapResult.result;
    console.log('Swap 交易哈希:', txHash);

    // 等待交易确认
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash as Hex,
      timeout: 30000
    });

    console.log('交易确认 status:', receipt.status);
    console.log('Gas 使用:', receipt.gasUsed.toString());
    console.log('事件日志数量:', receipt.logs.length);
    
    // ⚠️ 严格检查交易是否成功
    if (receipt.status !== 'success') {
      console.error('========== 交易失败（已被 revert）==========');
      console.error('交易哈希:', txHash);
      console.error('可能原因:');
      console.error('1. Pair 地址不正确或不存在');
      console.error('2. 储备不足或流动性不足');
      console.error('3. 代币余额不足');
      console.error('4. 滑点保护触发（输出小于最小值）');
      console.error('5. K 值检查失败');
      
      return NextResponse.json({
        success: false,
        error: `交易执行失败（已被 revert）\n\n` +
               `交易哈希: ${txHash}\n\n` +
               `可能原因：\n` +
               `• Pair 地址无效或不存在\n` +
               `• 代币余额不足\n` +
               `• 流动性不足\n` +
               `• 计算的输出金额不正确\n` +
               `• 滑点设置过小`,
      }, { status: 400 });
    }
    
    console.log('========== Swap 交易成功完成 ==========');

    return NextResponse.json({
      success: true,
      data: {
        txHash,
        amountIn,
        amountOut: formatUnits(amountOutWei, decimalsOut),
        amountOutMin: formatUnits(amountOutMin, decimalsOut),
        slippage: slippageNum === 0 ? 'AUTO (接受任何数量)' : `${slippageNum}%`,
        message: `成功交换 ${amountIn} 代币`,
      },
    });
  } catch (error) {
    console.error('Swap 执行失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Swap 执行失败',
      },
      { status: 500 }
    );
  }
}
