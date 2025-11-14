import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, encodeFunctionData, getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { Hex, Address } from 'viem';
import { getPrivateKeyFromDatabase, parseBlockchainError, getRpcUrl, createHttpTransport } from '@/lib/serverUtils';
import { ZERO_ADDRESS, normalizeAddress, tryNormalizeAddress, safeReadDecimals } from '@/lib/utils';


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

// 空 bytes 常量，用于 swap 的 data 参数
const EMPTY_BYTES: Hex = '0x';

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
  let debugCtx: Record<string, any> = {};
  let txHash: Hex | undefined; // 用于跟踪swap交易hash，即使失败也要返回
  let transferHash: Hex | undefined; // 用于跟踪transfer交易hash，即使失败也要返回
  try {
    const body = await request.json();
    const {
      account,
      toAddress,
      pairAddress,
      tokenIn,
      tokenOut,
      amountIn,
      gasLimit = 'auto',
      slippage = '0.5',
      network = 'fork',
    } = body;
    
    // 规范化与校验地址（使用 EIP-55 校验和）
    let accountAddr: Address;
    let toAddr: Address;
    let pairAddr: Address;
    let tokenInAddr: Address;
    let tokenOutAddr: Address;

    try {
      accountAddr = normalizeAddress(account);
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `账户地址无效: ${account}` },
        { status: 400 }
      );
    }
    try {
      pairAddr = normalizeAddress(pairAddress);
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `Pair 地址无效: ${pairAddress}` },
        { status: 400 }
      );
    }
    try {
      tokenInAddr = tokenIn === '0x0000000000000000000000000000000000000000' ? ZERO_ADDRESS : normalizeAddress(tokenIn);
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `输入代币地址无效: ${tokenIn}` },
        { status: 400 }
      );
    }
    try {
      tokenOutAddr = tokenOut === '0x0000000000000000000000000000000000000000' ? ZERO_ADDRESS : normalizeAddress(tokenOut);
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `输出代币地址无效: ${tokenOut}` },
        { status: 400 }
      );
    }
    // 如果没有提供toAddress，则使用account作为默认值
    try {
      toAddr = toAddress ? normalizeAddress(toAddress) : accountAddr;
    } catch (e: any) {
      toAddr = accountAddr;
    }

    // 使用 EIP-55 校验和地址进行合约交互，避免严格校验失败

    // 累积调试上下文（仅用于返回/日志，避免泄露敏感信息）
    debugCtx = {
      input: { account: accountAddr, pairAddress: pairAddr, tokenIn: tokenInAddr, tokenOut: tokenOutAddr, amountIn, slippage, network },
    };

    if (!account || !pairAddress || !tokenIn || !tokenOut || !amountIn) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    console.log('========== Swap 交易开始 ==========');
    console.log('账户:', accountAddr);
    console.log('接收地址 (To):', toAddr);
    
    // 1. 从数据库获取私钥
    const privateKey = await getPrivateKeyFromDatabase(account);
    if (!privateKey) {
      console.error('❌ 无法获取私钥');
      return NextResponse.json(
        { success: false, error: `账户 ${account} 的私钥不存在，请确保该账户已导入` },
        { status: 400 }
      );
    }
    
    // 2. 创建账户和客户端（无超时限制）
    const rpcUrl = getRpcUrl(network);
    debugCtx.rpcUrl = rpcUrl;
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
    
    console.log('✅ 成功创建 wallet client');
    console.log('Pair 地址:', pairAddr);
    console.log('输入代币:', tokenInAddr);
    console.log('输出代币:', tokenOutAddr);
    console.log('输入数量:', amountIn);

    // 获取 Pair 信息
    const token0 = await publicClient.readContract({
      address: pairAddr,
      abi: PAIR_ABI,
      functionName: 'token0',
    }) as Address;

    const token1 = await publicClient.readContract({
      address: pairAddr,
      abi: PAIR_ABI,
      functionName: 'token1',
    }) as Address;

    const reserves = await publicClient.readContract({
      address: pairAddr,
      abi: PAIR_ABI,
      functionName: 'getReserves',
    });

    const [reserve0, reserve1] = reserves as [bigint, bigint, number];

    debugCtx.pair = { token0, token1 };
    console.log('Pair 信息:');
    console.log('- Token0:', token0, '储备:', reserve0.toString());
    console.log('- Token1:', token1, '储备:', reserve1.toString());
    debugCtx.reserves = { reserve0: reserve0.toString(), reserve1: reserve1.toString() };

    // 确定输入输出顺序
    const isToken0In = tokenInAddr.toLowerCase() === token0.toLowerCase();
    const reserveIn = isToken0In ? reserve0 : reserve1;
    const reserveOut = isToken0In ? reserve1 : reserve0;
    debugCtx.path = { isToken0In };

    // 账户余额与基础信息调试
    try {
      const nativeBalance = await publicClient.getBalance({ address: accountAddr });
      console.log('账户原生币余额(Wei):', nativeBalance.toString());
      debugCtx.balances = { native: nativeBalance.toString() };
    } catch (e) {
      console.warn('⚠️ 获取账户原生币余额失败:', e);
    }
    try {
      if (tokenInAddr !== ZERO_ADDRESS) {
        const erc20Balance = await publicClient.readContract({
          address: tokenInAddr,
          abi: [
            { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
            { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
          ] as const,
          functionName: 'balanceOf',
          args: [accountAddr],
        }) as bigint;
        console.log('账户代币余额(Wei):', erc20Balance.toString());
        debugCtx.balances = { ...(debugCtx.balances || {}), erc20In: erc20Balance.toString() };
      }
    } catch (e) {
      console.warn('⚠️ 获取账户代币余额失败:', e);
    }

    // 获取代币精度（带重试与回退逻辑，规避不同链校验和差异）
    const decimalsIn = tokenInAddr === ZERO_ADDRESS ? 18 : await safeReadDecimals(publicClient, tokenInAddr);

    const decimalsOut = tokenOutAddr === ZERO_ADDRESS ? 18 : await safeReadDecimals(publicClient, tokenOutAddr);
    debugCtx = { ...(debugCtx || {}), decimals: { in: decimalsIn, out: decimalsOut } };

    // 转换输入数量
    const amountInWei = parseUnits(amountIn, decimalsIn);
    console.log('输入数量 (Wei):', amountInWei.toString());
    debugCtx.amounts = { amountInWei: amountInWei.toString() };

    // 计算输出数量
    const amountOutWei = getAmountOut(amountInWei, reserveIn, reserveOut);
    console.log('计算输出数量 (Wei):', amountOutWei.toString());
    debugCtx.amounts.amountOutWei = amountOutWei.toString();

    if (amountOutWei === BigInt(0)) {
      console.error('❌ 计算得到的输出为 0，可能是储备极低或数量过小');
      return NextResponse.json(
        { success: false, error: '计算得到的输出为 0；检查储备、输入数量与滑点设置' },
        { status: 400 }
      );
    }

    // 应用滑点
    // auto = 0（接受任何数量），其他为用户指定的百分比
    const slippageNum = slippage === 'auto' ? 0 : parseFloat(slippage);
    const amountOutMin = slippageNum === 0 
      ? BigInt(0) // auto 模式：接受任何输出数量
      : (amountOutWei * BigInt(Math.floor((100 - slippageNum) * 100))) / BigInt(10000);
    
    console.log('最小输出 (含滑点):', amountOutMin.toString());
    debugCtx.amounts.amountOutMin = amountOutMin.toString();
    if (slippageNum === 0) {
      console.log('滑点模式: AUTO (接受任何数量)');
    } else {
      console.log('滑点设置:', `${slippageNum}%`);
    }

    // 如果是 ERC20，先转账到 Pair
    if (tokenInAddr !== ZERO_ADDRESS) {
      console.log('转账代币到 Pair...');
      // 预估/模拟 transfer 调用，便于提前捕获 revert 原因
      try {
        const gasForTransfer = await publicClient.estimateGas({
          account: accountSigner,
          to: tokenInAddr,
          data: encodeFunctionData({
            abi: [
              { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [ { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' } ], outputs: [ { name: '', type: 'bool' } ] },
            ] as const,
            functionName: 'transfer',
            args: [pairAddr, amountInWei],
          }),
        });
        console.log('transfer 估算 Gas:', gasForTransfer.toString());
        debugCtx.gasEstimates = { ...(debugCtx.gasEstimates || {}), transfer: gasForTransfer.toString() };
      } catch (e) {
        console.warn('⚠️ transfer 估算 Gas 失败，可能会在发送时被拒绝:', e);
        debugCtx.gasEstimates = { ...(debugCtx.gasEstimates || {}), transfer: 'failed' };
      }
      
      const ERC20_TRANSFER_ABI = [
        {
          name: 'transfer',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ name: '', type: 'bool' }],
        },
      ] as const;
      
      // 使用 viem 的 writeContract（自动签名）
      transferHash = await walletClient.writeContract({
        address: tokenInAddr,
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [pairAddr, amountInWei],
      });
      
      console.log('✅ 转账交易已发送:', transferHash);
      // 记录transfer hash，以便在错误时返回
      debugCtx.transferHash = transferHash;
      
      // ⚠️ 重要：必须等待转账确认后再执行 swap，否则 Pair 合约还没有收到代币
      console.log('⏳ 等待代币转账确认...');
      const transferReceipt = await publicClient.waitForTransactionReceipt({ hash: transferHash! });
      
      if (transferReceipt.status !== 'success') {
        console.error('❌ 代币转账失败（已被 revert）:', transferHash);
        throw new Error('代币转账失败，无法继续执行 swap');
      }
      
      console.log('✅ 代币转账确认成功:', transferHash);
      
      // 验证 Pair 合约确实收到了代币
      try {
        const ERC20_BALANCE_ABI = [
          { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
        ] as const;
        const pairBalance = await publicClient.readContract({
          address: tokenInAddr,
          abi: ERC20_BALANCE_ABI,
          functionName: 'balanceOf',
          args: [pairAddr],
        }) as bigint;
        console.log('Pair 合约代币余额:', pairBalance.toString());
        debugCtx.pairTokenBalance = pairBalance.toString();
        
        if (pairBalance < amountInWei) {
          console.warn('⚠️ Pair 合约余额可能不足，但继续尝试 swap');
        }
      } catch (e) {
        console.warn('⚠️ 无法验证 Pair 合约余额:', e);
      }
    }

    // 调用 Pair 的 swap() 方法
    // 注意：swap() 需要的是实际输出数量，不是最小输出
    // 但是 Uniswap V2 会在内部检查 K 值，所以我们使用计算的输出数量
    const amount0Out = isToken0In ? BigInt(0) : amountOutWei;
    const amount1Out = isToken0In ? amountOutWei : BigInt(0);

    console.log('执行 Swap:');
    console.log('- amount0Out:', amount0Out);
    console.log('- amount1Out:', amount1Out);
    console.log('- 最小输出保护 (amountOutMin):', amountOutMin.toString());

    // 定义 Pair 的 swap ABI
    const SWAP_ABI = [
      {
        name: 'swap',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'amount0Out', type: 'uint256' },
          { name: 'amount1Out', type: 'uint256' },
          { name: 'to', type: 'address' },
          { name: 'data', type: 'bytes' },
        ],
        outputs: [],
      },
    ] as const;
    
    console.log('执行 Swap 交易...');

    // 在真正发送前尝试 simulate/estimate，提前发现会 revert 的情况
    try {
      const estimatedGas = await publicClient.estimateGas({
        account: accountSigner,
        to: pairAddr,
        data: encodeFunctionData({
          abi: [
            { name: 'swap', type: 'function', stateMutability: 'nonpayable', inputs: [ { name: 'amount0Out', type: 'uint256' }, { name: 'amount1Out', type: 'uint256' }, { name: 'to', type: 'address' }, { name: 'data', type: 'bytes' } ], outputs: [] },
          ] as const,
          functionName: 'swap',
          args: [ amount0Out, amount1Out, toAddr, EMPTY_BYTES ],
        }),
      });
      console.log('swap 估算 Gas:', estimatedGas.toString());
      debugCtx.gasEstimates = { ...(debugCtx.gasEstimates || {}), swap: estimatedGas.toString() };
    } catch (e) {
      console.error('❌ swap 估算 Gas 失败，交易大概率会被拒绝:', e);
      debugCtx.gasEstimates = { ...(debugCtx.gasEstimates || {}), swap: 'failed' };
    }
    
    // 使用 viem 的 writeContract（自动签名）
    txHash = await walletClient.writeContract({
      address: pairAddr,
      abi: SWAP_ABI,
      functionName: 'swap',
      args: [ amount0Out, amount1Out, toAddr, EMPTY_BYTES ],
    });

    console.log('✅ Swap 交易已发送, 哈希:', txHash);

    // 🚀 立即返回 hash，不等待确认
    // 用户可以使用 cast 工具查看交易状态：
    // cast tx <hash> --rpc-url http://anvil-api:8545
    // cast receipt <hash> --rpc-url http://anvil-api:8545
    
    // 异步后台等待交易确认（不阻塞响应）
    publicClient.waitForTransactionReceipt({ hash: txHash! }).then((receipt) => {
      console.log('✅ Swap 交易已确认, 哈希:', txHash);
      console.log('交易确认 status:', receipt.status);
      console.log('Gas 使用:', receipt.gasUsed.toString());
      console.log('事件日志数量:', receipt.logs.length);
      
      if (receipt.status !== 'success') {
        console.error('❌ Swap 交易失败（已被 revert）:', txHash);
        console.error('可能原因:');
        console.error('1. Pair 地址不正确或不存在');
        console.error('2. 储备不足或流动性不足');
        console.error('3. 代币余额不足');
        console.error('4. 滑点保护触发（输出小于最小值）');
        console.error('5. K 值检查失败');
      }
    }).catch((err) => {
      console.error('❌ 等待 Swap 交易确认时出错:', err);
    });
    
    console.log('========== Swap 交易已提交 ==========');

    return NextResponse.json({
      success: true,
      data: {
        txHash,
        amountIn,
        amountOut: formatUnits(amountOutWei, decimalsOut),
        amountOutMin: formatUnits(amountOutMin, decimalsOut),
        slippage: slippageNum === 0 ? 'AUTO (接受任何数量)' : `${slippageNum}%`,
        message: `Swap 交易已提交`,
        tip: `使用 cast tx ${txHash} --rpc-url http://anvil-api:8545 查看交易详情`,
      },
    });
  } catch (error: any) {
    console.error('❌ Swap 执行失败:', error);
    
    // 尝试从错误中提取交易hash（某些情况下错误可能包含hash）
    // 优先使用swap的hash，如果没有则使用transfer的hash
    let errorTxHash = txHash || transferHash;
    if (!errorTxHash && error?.hash) {
      errorTxHash = error.hash;
    }
    if (!errorTxHash && error?.transactionHash) {
      errorTxHash = error.transactionHash;
    }
    
    // 如果有transfer hash但没有swap hash，在错误信息中说明
    if (transferHash && !txHash) {
      debugCtx.failedAt = 'transfer';
    } else if (txHash) {
      debugCtx.failedAt = 'swap';
    }
    
    // 尝试提取详细的 revert 原因
    let detailedError = '';
    if (error?.reason) {
      detailedError = error.reason;
      console.error('Revert 原因:', error.reason);
    } else if (error?.shortMessage) {
      // viem 的错误格式：提取 revert reason
      const reasonMatch = error.shortMessage.match(/reverted with the following reason:\s*(.+?)(?:\n|$)/i);
      if (reasonMatch) {
        detailedError = reasonMatch[1].trim();
        console.error('提取的 Revert 原因:', detailedError);
      }
    }
    
    // 使用统一的错误解读函数
    const friendlyErrorMessage = parseBlockchainError(error);
    console.error('解读后的错误:', friendlyErrorMessage);
    
    // 如果提取到了详细的 revert 原因，添加到错误信息中
    let finalErrorMessage = detailedError 
      ? `${friendlyErrorMessage}\n\n详细原因: ${detailedError}`
      : friendlyErrorMessage;
    
    // 如果有交易hash，添加到错误信息中
    if (errorTxHash) {
      finalErrorMessage += `\n\n交易哈希: ${errorTxHash}`;
      finalErrorMessage += `\n提示: 使用 cast tx ${errorTxHash} --rpc-url ${getRpcUrl(debugCtx?.input?.network || 'fork')} 查看交易详情`;
    }
    
    return NextResponse.json(
      {
        success: false,
        error: finalErrorMessage,
        data: errorTxHash ? { txHash: errorTxHash } : undefined,
        debug: {
          hint: '查看服务日志获取更详细的链上错误与上下文',
          context: debugCtx,
          revertReason: detailedError || undefined,
        },
      },
      { status: 500 }
    );
  }
}
