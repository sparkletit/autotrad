import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { Hex } from 'viem';
import { getPrivateKeyFromDatabase, parseBlockchainError, getRpcUrl, createHttpTransport } from '@/lib/serverUtils';


// PancakeSwap V2 Router 地址
const ROUTER_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

// Router ABI - removeLiquidity
const ROUTER_ABI = [
  {
    name: 'removeLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'liquidity', type: 'uint256' },
      { name: 'amountAMin', type: 'uint256' },
      { name: 'amountBMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountA', type: 'uint256' },
      { name: 'amountB', type: 'uint256' },
    ],
  },
] as const;

// Pair ABI
const PAIR_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
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
    outputs: [{ name: '', type: 'address' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'token1',
    outputs: [{ name: '', type: 'address' }],
    type: 'function',
  },
] as const;

// ERC20 ABI (LP Token)
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
] as const;

/**
 * POST /api/swap/remove-liquidity
 * 移除流动性
 */
export async function POST(request: NextRequest) {
  let debugCtx: Record<string, any> | undefined;
  let txHash: string | undefined;

  try {
    const body = await request.json();
    const {
      account,
      toAddress,
      pairAddress,
      liquidity,
      amountAMin,
      amountBMin,
      slippage = '0.5',
      network = 'fork',
    } = body;

    const liquidityToAddress = toAddress || account;
    debugCtx = {
      input: { account, pairAddress, liquidity, slippage, network },
    };

    if (!account || !pairAddress || !liquidity) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    console.log('========== 移除流动性开始 ==========');
    console.log('📋 输入参数:');
    console.log('  - 账户 (From):', account);
    console.log('  - 接收地址 (To):', liquidityToAddress);
    console.log('  - Pair地址:', pairAddress);
    console.log('  - 流动性数量:', liquidity);
    console.log('  - 滑点设置:', slippage);
    console.log('  - 网络:', network);
    console.log('  - RPC URL:', getRpcUrl(network));

    // 1. 从数据库获取私钥
    const privateKey = await getPrivateKeyFromDatabase(account);
    if (!privateKey) {
      return NextResponse.json(
        { success: false, error: `账户 ${account} 的私钥不存在，请确保该账户已导入` },
        { status: 400 }
      );
    }

    // 2. 创建客户端
    const rpcUrl = getRpcUrl(network);
    const accountSigner = privateKeyToAccount(privateKey as Hex);

    const transport = createHttpTransport(rpcUrl, { timeout: 0, retryCount: 3, retryDelay: 1000 });

    const publicClient = createPublicClient({
      chain: bsc,
      transport,
    });

    const walletClient = createWalletClient({
      account: accountSigner,
      chain: bsc,
      transport,
    });

    // 3. 获取Pair信息
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
    const totalSupply = await publicClient.readContract({
      address: pairAddress as Hex,
      abi: PAIR_ABI,
      functionName: 'totalSupply',
    }) as bigint;

    console.log('📊 Pair 信息:');
    console.log('  - Token0:', token0);
    console.log('  - Token1:', token1);
    console.log('  - Reserve0:', reserve0.toString(), `(${formatUnits(reserve0, 18)})`);
    console.log('  - Reserve1:', reserve1.toString(), `(${formatUnits(reserve1, 18)})`);
    console.log('  - Total Supply:', totalSupply.toString(), `(${formatUnits(totalSupply, 18)} LP)`);

    // 4. 计算预期输出
    const liquidityWei = parseUnits(liquidity, 18);

    console.log('💰 流动性计算:');
    console.log('  - 流动性数量 (Wei):', liquidityWei.toString());
    console.log('  - 流动性数量 (格式化):', liquidity);

    if (totalSupply === BigInt(0)) {
      console.error('❌ 交易池总供应量为0');
      return NextResponse.json(
        { success: false, error: '交易池总供应量为0，无法移除流动性' },
        { status: 400 }
      );
    }

    const amount0Out = (liquidityWei * reserve0) / totalSupply;
    const amount1Out = (liquidityWei * reserve1) / totalSupply;

    console.log('📈 预期输出:');
    console.log('  - Amount0 (Wei):', amount0Out.toString(), `(${formatUnits(amount0Out, 18)} Token0)`);
    console.log('  - Amount1 (Wei):', amount1Out.toString(), `(${formatUnits(amount1Out, 18)} Token1)`);

    // 5. 确定tokenA和tokenB的顺序（Router要求tokenA < tokenB）
    const token0Lower = token0.toLowerCase();
    const token1Lower = token1.toLowerCase();

    let finalTokenA = token0;
    let finalTokenB = token1;
    let finalAmountAOut = amount0Out;
    let finalAmountBOut = amount1Out;

    if (token0Lower > token1Lower) {
      finalTokenA = token1;
      finalTokenB = token0;
      finalAmountAOut = amount1Out;
      finalAmountBOut = amount0Out;
    }

    // 6. 应用滑点计算最小值
    const slippageNum = slippage === 'auto' ? 0 : parseFloat(slippage);
    let finalAmountAMin: bigint;
    let finalAmountBMin: bigint;

    console.log('📉 滑点计算:');
    console.log('  - 滑点设置:', slippage, slippageNum === 0 ? '(auto)' : `(${slippageNum}%)`);
    console.log('  - AmountA Out (Wei):', finalAmountAOut.toString(), `(${formatUnits(finalAmountAOut, 18)})`);
    console.log('  - AmountB Out (Wei):', finalAmountBOut.toString(), `(${formatUnits(finalAmountBOut, 18)})`);

    if (slippageNum === 0) {
      finalAmountAMin = (finalAmountAOut * BigInt(99)) / BigInt(100);
      finalAmountBMin = (finalAmountBOut * BigInt(99)) / BigInt(100);
      console.log('  - 使用默认1%滑点保护（auto模式）');
    } else {
      finalAmountAMin = (finalAmountAOut * BigInt(Math.floor((100 - slippageNum) * 100))) / BigInt(10000);
      finalAmountBMin = (finalAmountBOut * BigInt(Math.floor((100 - slippageNum) * 100))) / BigInt(10000);
      console.log('  - 应用滑点:', `${slippageNum}%`);
    }

    if (finalAmountAMin === BigInt(0) && finalAmountAOut > BigInt(0)) {
      console.log('  - ⚠️ AmountA Min为0，设置为1');
      finalAmountAMin = BigInt(1);
    }
    if (finalAmountBMin === BigInt(0) && finalAmountBOut > BigInt(0)) {
      console.log('  - ⚠️ AmountB Min为0，设置为1');
      finalAmountBMin = BigInt(1);
    }

    console.log('  - AmountA Min (Wei):', finalAmountAMin.toString(), `(${formatUnits(finalAmountAMin, 18)})`);
    console.log('  - AmountB Min (Wei):', finalAmountBMin.toString(), `(${formatUnits(finalAmountBMin, 18)})`);

    if (amountAMin) {
      finalAmountAMin = parseUnits(amountAMin, 18);
    }
    if (amountBMin) {
      finalAmountBMin = parseUnits(amountBMin, 18);
    }

    // 设置deadline
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

    console.log('🔧 最终参数（Router调用）:');
    console.log('  - TokenA:', finalTokenA, '(地址较小的)');
    console.log('  - TokenB:', finalTokenB, '(地址较大的)');
    console.log('  - Liquidity (Wei):', liquidityWei.toString());
    console.log('  - AmountA Min (Wei):', finalAmountAMin.toString(), `(${formatUnits(finalAmountAMin, 18)})`);
    console.log('  - AmountB Min (Wei):', finalAmountBMin.toString(), `(${formatUnits(finalAmountBMin, 18)})`);
    console.log('  - To Address:', liquidityToAddress);
    console.log('  - Deadline:', deadline.toString(), `(${new Date(Number(deadline) * 1000).toISOString()})`);

    // 7. 授权LP Token
    const lpAllowance = await publicClient.readContract({
      address: pairAddress as Hex,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account as Hex, ROUTER_ADDRESS as Hex],
    }) as bigint;

    const userLpBalance = await publicClient.readContract({
      address: pairAddress as Hex,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account as Hex],
    }) as bigint;

    console.log('🔐 授权检查:');
    console.log('  - 用户LP余额 (Wei):', userLpBalance.toString(), `(${formatUnits(userLpBalance, 18)} LP)`);
    console.log('  - 当前授权数量 (Wei):', lpAllowance.toString(), `(${formatUnits(lpAllowance, 18)})`);
    console.log('  - 需要移除数量 (Wei):', liquidityWei.toString(), `(${formatUnits(liquidityWei, 18)} LP)`);
    console.log('  - 授权是否足够:', lpAllowance >= liquidityWei ? '✅ 是' : '❌ 否');

    if (userLpBalance < liquidityWei) {
      return NextResponse.json(
        { success: false, error: `LP余额不足。当前余额: ${formatUnits(userLpBalance, 18)}, 需要: ${liquidity}` },
        { status: 400 }
      );
    }

    // 总是重新授权为准确的数量（就像成功的脚本一样）
    const needsApproval = lpAllowance < liquidityWei;
    
    if (needsApproval) {
      console.log('🔐 需要授权 LP Token...');
      console.log('  - 当前授权:', lpAllowance.toString(), `(${formatUnits(lpAllowance, 18)})`);
      console.log('  - 需要授权:', liquidityWei.toString(), `(${liquidity})`);
      console.log('  - 授权目标: Router', ROUTER_ADDRESS);
      console.log('  - 授权数量: 准确数量 (模仿成功脚本的做法)');
      
      const approveHash = await walletClient.writeContract({
        address: pairAddress as Hex,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [ROUTER_ADDRESS as Hex, liquidityWei],
        gas: BigInt(200000), // 授权通常只需要少量 gas
      });
      console.log('  - 授权交易已发送:', approveHash);
      
      const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
      if (approveReceipt.status !== 'success') {
        console.error('  - ❌ 授权交易失败');
        console.error('  - 收据:', approveReceipt);
        return NextResponse.json(
          { 
            success: false, 
            error: 'LP Token 授权失败',
            data: { txHash: approveHash },
          },
          { status: 500 }
        );
      }
      console.log('  - ✅ 授权交易确认成功');

      const newAllowance = await publicClient.readContract({
        address: pairAddress as Hex,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account as Hex, ROUTER_ADDRESS as Hex],
      }) as bigint;
      console.log('  - 授权后数量 (Wei):', newAllowance.toString());
      console.log('  - 授权后数量 (格式化):', formatUnits(newAllowance, 18));
      console.log('  - 授权是否足够:', newAllowance >= liquidityWei ? '✅ 是' : '❌ 否');
      
      // 如果授权后仍然不足，返回错误
      if (newAllowance < liquidityWei) {
        console.error('  - ❌ 授权后额度仍然不足');
        return NextResponse.json(
          { 
            success: false, 
            error: `授权失败：授权后额度 ${formatUnits(newAllowance, 18)} 仍小于需要的 ${liquidity}`,
            data: { txHash: approveHash },
          },
          { status: 500 }
        );
      }
    } else {
      console.log('  - ✅ 授权已足够，无需重新授权');
      console.log('  - 当前授权:', lpAllowance.toString(), `(${formatUnits(lpAllowance, 18)})`);
      console.log('  - 需要移除:', liquidityWei.toString(), `(${liquidity})`);
    }

    // 8. 调用 Router 的 removeLiquidity 方法
    console.log('🚀 准备调用 Router.removeLiquidity...');
    console.log('  - Router地址:', ROUTER_ADDRESS);
    console.log('  - 函数名: removeLiquidity');
    console.log('  - 参数列表:');
    console.log('    [0] tokenA:', finalTokenA);
    console.log('    [1] tokenB:', finalTokenB);
    console.log('    [2] liquidity:', liquidityWei.toString());
    console.log('    [3] amountAMin:', finalAmountAMin.toString());
    console.log('    [4] amountBMin:', finalAmountBMin.toString());
    console.log('    [5] to:', liquidityToAddress);
    console.log('    [6] deadline:', deadline.toString());

    try {
      const estimatedGas = await publicClient.estimateGas({
        account: accountSigner,
        to: ROUTER_ADDRESS as Hex,
        data: encodeFunctionData({
          abi: ROUTER_ABI,
          functionName: 'removeLiquidity',
          args: [
            finalTokenA as Hex,
            finalTokenB as Hex,
            liquidityWei,
            finalAmountAMin,
            finalAmountBMin,
            liquidityToAddress as Hex,
            deadline,
          ],
        }),
      });
      console.log('  - 估算Gas:', estimatedGas.toString());
    } catch (gasError: any) {
      console.error('  - ⚠️ Gas估算失败:', gasError.message);
    }

    const callData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'removeLiquidity',
      args: [
        finalTokenA as Hex,
        finalTokenB as Hex,
        liquidityWei,
        finalAmountAMin,
        finalAmountBMin,
        liquidityToAddress as Hex,
        deadline,
      ],
    });
    console.log('  - 调用数据 (calldata):', callData);
    console.log('  - 📝 可以使用以下cast命令测试:');
    console.log(`    cast send ${ROUTER_ADDRESS} "${callData}" --rpc-url ${getRpcUrl(network)} --private-key <PRIVATE_KEY>`);

    txHash = await walletClient.writeContract({
      address: ROUTER_ADDRESS as Hex,
      abi: ROUTER_ABI,
      functionName: 'removeLiquidity',
      args: [
        finalTokenA as Hex,
        finalTokenB as Hex,
        liquidityWei,
        finalAmountAMin,
        finalAmountBMin,
        liquidityToAddress as Hex,
        deadline,
      ],
      // 设置非常大的 gas limit（5,000,000）
      // 某些token的transfer函数非常复杂（如分红机制），实测需要2,000,000+ gas
      gas: BigInt(5000000),
    });

    console.log('✅ 移除流动性交易已发送');
    console.log('  - 交易哈希:', txHash);
    console.log('  - 📝 可以使用以下命令查看交易:');
    console.log(`    cast tx ${txHash} --rpc-url ${getRpcUrl(network)}`);
    console.log(`    cast receipt ${txHash} --rpc-url ${getRpcUrl(network)}`);
    console.log('========== 移除流动性交易已提交 ==========');

    return NextResponse.json({
      success: true,
      data: {
        txHash,
        message: '移除流动性交易已提交',
        tip: `使用 cast tx ${txHash} --rpc-url ${rpcUrl} 查看交易详情`,
      },
    });
  } catch (error: any) {
    console.error('❌ 移除流动性失败:', error);
    console.error('❌ 错误类型:', error?.constructor?.name);
    console.error('❌ 错误消息:', error?.message);
    console.error('❌ 错误堆栈:', error?.stack);

    let errorTxHash = txHash;
    if (!errorTxHash && error?.hash) {
      errorTxHash = error.hash;
    }
    if (!errorTxHash && error?.transactionHash) {
      errorTxHash = error.transactionHash;
    }

    let detailedError = '';
    if (error?.reason) {
      detailedError = error.reason;
    } else if (error?.shortMessage) {
      const reasonMatch = error.shortMessage.match(/reverted with the following reason:\s*(.+?)(?:\n|$)/i);
      if (reasonMatch) {
        detailedError = reasonMatch[1].trim();
      }
    } else if (error?.message) {
      const reasonMatch = error.message.match(/reverted with the following reason:\s*(.+?)(?:\n|$)/i);
      if (reasonMatch) {
        detailedError = reasonMatch[1].trim();
      }
    }

    const friendlyErrorMessage = parseBlockchainError(error);
    let finalErrorMessage = friendlyErrorMessage;

    if (detailedError) {
      finalErrorMessage += `\n\n详细原因: ${detailedError}`;
    }

    if (errorTxHash) {
      finalErrorMessage += `\n\n交易哈希: ${errorTxHash}`;
      finalErrorMessage += `\n提示: 使用 cast tx ${errorTxHash} --rpc-url ${getRpcUrl(debugCtx?.input?.network || 'fork')} 查看交易详情`;
    }

    const errorResponse = {
      success: false,
      error: finalErrorMessage,
      data: errorTxHash ? { txHash: errorTxHash } : undefined,
      debug: {
        hint: '查看服务日志获取更详细的链上错误与上下文',
        context: debugCtx,
        revertReason: detailedError || undefined,
        errorType: error?.constructor?.name,
        errorMessage: error?.message,
      },
    };

    console.error('❌ 返回错误响应:', JSON.stringify(errorResponse, null, 2));

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
