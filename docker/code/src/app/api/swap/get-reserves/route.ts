import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
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

// Pair ABI - getReserves 方法
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

/**
 * POST /api/swap/get-reserves
 * 查询 Pair 合约的储备信息
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pairAddress, network = 'fork' } = body;

    // 参数验证
    if (!pairAddress) {
      return NextResponse.json(
        { success: false, error: '缺少参数：pairAddress' },
        { status: 400 }
      );
    }

    // 验证地址格式
    if (!pairAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { success: false, error: '无效的 Pair 地址格式' },
        { status: 400 }
      );
    }

    const rpcUrl = getRpcUrl(network);
    const publicClient = createPublicClient({ transport: http(rpcUrl) });

    console.log('查询 Pair 储备:');
    console.log('- Pair 地址:', pairAddress);
    console.log('- 网络:', network);

    // 查询 getReserves
    const reserves = await publicClient.readContract({
      address: pairAddress as Hex,
      abi: PAIR_ABI,
      functionName: 'getReserves',
    });

    // 查询 token0 和 token1
    const token0 = await publicClient.readContract({
      address: pairAddress as Hex,
      abi: PAIR_ABI,
      functionName: 'token0',
    });

    const token1 = await publicClient.readContract({
      address: pairAddress as Hex,
      abi: PAIR_ABI,
      functionName: 'token1',
    });

    const [reserve0, reserve1, blockTimestampLast] = reserves as [bigint, bigint, number];

    console.log('储备查询成功:');
    console.log('- Token0:', token0);
    console.log('- Reserve0:', reserve0.toString());
    console.log('- Token1:', token1);
    console.log('- Reserve1:', reserve1.toString());
    console.log('- Block Timestamp:', blockTimestampLast);

    return NextResponse.json({
      success: true,
      data: {
        reserve0: reserve0.toString(),
        reserve1: reserve1.toString(),
        blockTimestampLast,
        token0: token0 as string,
        token1: token1 as string,
      },
    });
  } catch (error) {
    console.error('查询储备失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '查询储备失败',
      },
      { status: 500 }
    );
  }
}
