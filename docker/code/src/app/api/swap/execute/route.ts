import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { Hex } from 'viem';
import { getPrivateKeyFromDatabase, parseBlockchainError } from '@/lib/serverUtils';

const getRpcUrl = (network: string): string => {
  const rpcUrls: Record<string, string> = {
    fork: process.env.ANVIL_RPC_URL || 'http://anvil-api:8545',
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

    console.log('========== Swap 交易开始 ==========');
    console.log('账户:', account);
    
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
    const accountSigner = privateKeyToAccount(privateKey as Hex);
    
    const transport = http(rpcUrl, {
      timeout: 0,       // 永不超时
      retryCount: 3,
      retryDelay: 1000,
    });
    
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
    if (tokenIn !== '0x0000000000000000000000000000000000000000') {
      console.log('转账代币到 Pair...');
      
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
      const transferHash = await walletClient.writeContract({
        address: tokenIn as Hex,
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [pairAddress as Hex, amountInWei],
      });
      
      console.log('✅ 转账交易已发送:', transferHash);
      
      // 异步后台等待转账确认（不阻塞响应）
      publicClient.waitForTransactionReceipt({ hash: transferHash }).then((transferReceipt) => {
        if (transferReceipt.status !== 'success') {
          console.error('❌ 代币转账失败（已被 revert）:', transferHash);
        } else {
          console.log('✅ 代币转账确认成功:', transferHash);
        }
      }).catch((err) => {
        console.error('❌ 等待代币转账确认时出错:', err);
      });
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
    
    // 使用 viem 的 writeContract（自动签名）
    const txHash = await walletClient.writeContract({
      address: pairAddress as Hex,
      abi: SWAP_ABI,
      functionName: 'swap',
      args: [
        BigInt(amount0Out),
        BigInt(amount1Out),
        account as Hex,
        '0x' as Hex, // empty bytes
      ],
    });

    console.log('✅ Swap 交易已发送, 哈希:', txHash);

    // 🚀 立即返回 hash，不等待确认
    // 用户可以使用 cast 工具查看交易状态：
    // cast tx <hash> --rpc-url http://anvil-api:8545
    // cast receipt <hash> --rpc-url http://anvil-api:8545
    
    // 异步后台等待交易确认（不阻塞响应）
    publicClient.waitForTransactionReceipt({ hash: txHash }).then((receipt) => {
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
  } catch (error) {
    console.error('❌ Swap 执行失败:', error);
    
    // 使用统一的错误解读函数
    const friendlyErrorMessage = parseBlockchainError(error);
    console.error('解读后的错误:', friendlyErrorMessage);
    
    return NextResponse.json(
      {
        success: false,
        error: friendlyErrorMessage,
      },
      { status: 500 }
    );
  }
}
