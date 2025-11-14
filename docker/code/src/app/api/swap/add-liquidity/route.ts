import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { Hex } from 'viem';
import { getPrivateKeyFromDatabase, parseBlockchainError, getRpcUrl, createHttpTransport } from '@/lib/serverUtils';


// PancakeSwap V2 Router 地址
const ROUTER_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

// Router ABI - addLiquidity
const ROUTER_ABI = [
  {
    name: 'addLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'amountADesired', type: 'uint256' },
      { name: 'amountBDesired', type: 'uint256' },
      { name: 'amountAMin', type: 'uint256' },
      { name: 'amountBMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountA', type: 'uint256' },
      { name: 'amountB', type: 'uint256' },
      { name: 'liquidity', type: 'uint256' },
    ],
  },
  {
    name: 'addLiquidityETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amountTokenDesired', type: 'uint256' },
      { name: 'amountTokenMin', type: 'uint256' },
      { name: 'amountETHMin', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountToken', type: 'uint256' },
      { name: 'amountETH', type: 'uint256' },
      { name: 'liquidity', type: 'uint256' },
    ],
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
  {
    constant: true,
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
] as const;

/**
 * POST /api/swap/add-liquidity
 * 增加流动性
 */
export async function POST(request: NextRequest) {
  let debugCtx: Record<string, any> | undefined;
  let txHash: string | undefined;
  try {
    const body = await request.json();
    const {
      account,
      toAddress,
      tokenA,
      tokenB,
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      slippage = '0.5',
      network = 'fork',
    } = body;

    // 如果没有提供toAddress，则使用account作为默认值
    const liquidityToAddress = toAddress || account;

    debugCtx = {
      input: { account, tokenA, tokenB, amountADesired, amountBDesired, slippage, network },
    };

    if (!account || !tokenA || !tokenB || !amountADesired || !amountBDesired) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    console.log('========== 增加流动性开始 ==========');
    console.log('账户:', account);
    console.log('接收地址 (To):', liquidityToAddress);
    console.log('TokenA:', tokenA);
    console.log('TokenB:', tokenB);
    console.log('AmountA Desired:', amountADesired);
    console.log('AmountB Desired:', amountBDesired);

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

    // 3. 获取代币精度
    let decimalsA = 18;
    let decimalsB = 18;

    if (tokenA !== '0x0000000000000000000000000000000000000000') {
      decimalsA = await publicClient.readContract({
        address: tokenA as Hex,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }) as number;
    }

    if (tokenB !== '0x0000000000000000000000000000000000000000') {
      decimalsB = await publicClient.readContract({
        address: tokenB as Hex,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }) as number;
    }

    // 4. 转换数量
    const amountADesiredWei = parseUnits(amountADesired, decimalsA);
    const amountBDesiredWei = parseUnits(amountBDesired, decimalsB);

    // 计算最小数量（应用滑点）
    const slippageNum = slippage === 'auto' ? 0 : parseFloat(slippage);
    const amountAMinWei = slippageNum === 0
      ? BigInt(0)
      : (amountADesiredWei * BigInt(Math.floor((100 - slippageNum) * 100))) / BigInt(10000);
    const amountBMinWei = slippageNum === 0
      ? BigInt(0)
      : (amountBDesiredWei * BigInt(Math.floor((100 - slippageNum) * 100))) / BigInt(10000);

    // 如果用户提供了自定义的最小值，使用用户的值
    const finalAmountAMin = amountAMin ? parseUnits(amountAMin, decimalsA) : amountAMinWei;
    const finalAmountBMin = amountBMin ? parseUnits(amountBMin, decimalsB) : amountBMinWei;

    // 5. 确保tokenA < tokenB（Router要求）
    const tokenALower = tokenA.toLowerCase();
    const tokenBLower = tokenB.toLowerCase();
    let finalTokenA = tokenA;
    let finalTokenB = tokenB;
    let finalAmountA = amountADesiredWei;
    let finalAmountB = amountBDesiredWei;
    let finalMinA = finalAmountAMin;
    let finalMinB = finalAmountBMin;

    if (tokenALower > tokenBLower) {
      // 交换顺序
      finalTokenA = tokenB;
      finalTokenB = tokenA;
      finalAmountA = amountBDesiredWei;
      finalAmountB = amountADesiredWei;
      finalMinA = finalAmountBMin;
      finalMinB = finalAmountAMin;
    }

    // 6. 授权代币（如果需要）
    if (finalTokenA !== '0x0000000000000000000000000000000000000000') {
      const allowanceA = await publicClient.readContract({
        address: finalTokenA as Hex,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account as Hex, ROUTER_ADDRESS as Hex],
      }) as bigint;

      if (allowanceA < finalAmountA) {
        console.log('授权 TokenA...');
        const approveHash = await walletClient.writeContract({
          address: finalTokenA as Hex,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ROUTER_ADDRESS as Hex, finalAmountA],
        });
        console.log('TokenA 授权交易已发送:', approveHash);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        console.log('TokenA 授权确认成功');
      }
    }

    if (finalTokenB !== '0x0000000000000000000000000000000000000000') {
      const allowanceB = await publicClient.readContract({
        address: finalTokenB as Hex,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account as Hex, ROUTER_ADDRESS as Hex],
      }) as bigint;

      if (allowanceB < finalAmountB) {
        console.log('授权 TokenB...');
        const approveHash = await walletClient.writeContract({
          address: finalTokenB as Hex,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ROUTER_ADDRESS as Hex, finalAmountB],
        });
        console.log('TokenB 授权交易已发送:', approveHash);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        console.log('TokenB 授权确认成功');
      }
    }

    // 7. 设置deadline（当前时间 + 20分钟）
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

    const isNativeA = finalTokenA === '0x0000000000000000000000000000000000000000';
    const isNativeB = finalTokenB === '0x0000000000000000000000000000000000000000';

    if (isNativeA !== isNativeB && (isNativeA || isNativeB)) {
      const token = isNativeA ? (finalTokenB as Hex) : (finalTokenA as Hex);
      const amountTokenDesired = isNativeA ? finalAmountB : finalAmountA;
      const amountTokenMin = isNativeA ? finalMinB : finalMinA;
      const amountETHMin = isNativeA ? finalMinA : finalMinB;
      const nativeValue = isNativeA ? finalAmountA : finalAmountB;
      const sim = await publicClient.simulateContract({
        address: ROUTER_ADDRESS as Hex,
        abi: ROUTER_ABI,
        functionName: 'addLiquidityETH',
        args: [
          token,
          amountTokenDesired,
          amountTokenMin,
          amountETHMin,
          liquidityToAddress as Hex,
          deadline,
        ],
        account: accountSigner,
        chain: bsc,
        value: nativeValue,
      });
      txHash = await walletClient.writeContract(sim.request);
    } else {
      const sim = await publicClient.simulateContract({
        address: ROUTER_ADDRESS as Hex,
        abi: ROUTER_ABI,
        functionName: 'addLiquidity',
        args: [
          finalTokenA as Hex,
          finalTokenB as Hex,
          finalAmountA,
          finalAmountB,
          finalMinA,
          finalMinB,
          liquidityToAddress as Hex,
          deadline,
        ],
        account: accountSigner,
        chain: bsc,
        value: BigInt(0),
      });
      txHash = await walletClient.writeContract(sim.request);
    }

    console.log('✅ 增加流动性交易已发送, 哈希:', txHash);

    return NextResponse.json({
      success: true,
      data: {
        txHash,
        message: '增加流动性交易已提交',
        tip: `使用 cast tx ${txHash} --rpc-url ${rpcUrl} 查看交易详情`,
      },
    });
  } catch (error: any) {
    console.error('❌ 增加流动性失败:', error);

    let errorTxHash = txHash;
    if (!errorTxHash && error?.hash) {
      errorTxHash = error.hash;
    }
    if (!errorTxHash && error?.transactionHash) {
      errorTxHash = error.transactionHash;
    }

    const friendlyErrorMessage = parseBlockchainError(error);
    let finalErrorMessage = friendlyErrorMessage;

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
          shortMessage: error?.shortMessage,
          cause: error?.cause?.message,
        },
      },
      { status: 500 }
    );
  }
}
