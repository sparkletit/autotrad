import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';
import { Hex, getAddress } from 'viem';

// 强制在 Node.js 运行时执行，避免 Edge 环境下的兼容性问题
export const runtime = 'nodejs';

const RPC_URLS = [
  'https://bsc-dataseed2.defibit.io/',
  'https://1rpc.io/bnb',
  'https://bsc.publicnode.com',
];

// 与其他路由保持一致的 RPC 选择逻辑
const getRpcUrl = (network: string): string => {
  const rpcUrls: Record<string, string> = {
    fork: process.env.ANVIL_RPC_URL || 'http://anvil-api:8545',
    ethereum: 'https://mainnet.infura.io/v3/YOUR_KEY',
    bsc: 'https://bsc-dataseed1.bnbchain.org',
    polygon: 'https://polygon-rpc.com',
  };
  // 对于未知网络，保持该路由的原始语义（默认 bsc）
  return rpcUrls[network] || rpcUrls.bsc;
};

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
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'token0',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'token1',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    type: 'function',
  },
] as const;

export async function GET(_req: NextRequest, { params }: { params: { address: string } }) {
  const searchParams = _req.nextUrl.searchParams;
  const network = (searchParams.get('network') || 'bsc').toLowerCase();

  // 地址规范化与校验（使用 viem 的 getAddress 做校验）
  let addressHex: Hex;
  try {
    addressHex = getAddress(params.address) as Hex; // 会抛错，无需再做长度/前缀校验
  } catch (e) {
    return NextResponse.json(
      { success: false, error: '无效地址格式，应为 0x 开头的 40 位十六进制' },
      { status: 400 }
    );
  }

  let lastError: any;
  // 构建待尝试的 RPC 列表：bsc 使用多节点兜底，其它网络使用单节点
  const rpcCandidates = network === 'bsc' ? [...RPC_URLS] : [getRpcUrl(network)];

  for (const url of rpcCandidates) {
    try {
      const client = createPublicClient({
        chain: bsc, // 与项目其它路由一致，默认 BSC（fork 也为 BSC 的分叉）
        transport: http(url, { batch: false }),
      });

      // 先检查是否为合约地址
      const code = await client.getCode({ address: addressHex });
      if (!code || code === '0x') {
        return NextResponse.json(
          {
            success: false,
            error: `目标地址在 ${network} 上不存在合约代码，可能不是有效的 Pair 合约`,
            details: { address: addressHex, network, rpcUrl: url },
          },
          { status: 400 }
        );
      }

      const reserves = await client.readContract({
        address: addressHex,
        abi: PAIR_ABI,
        functionName: 'getReserves',
      });

      const token0 = (await client.readContract({ address: addressHex, abi: PAIR_ABI, functionName: 'token0' })) as string;
      const token1 = (await client.readContract({ address: addressHex, abi: PAIR_ABI, functionName: 'token1' })) as string;

      const [reserve0, reserve1, blockTimestampLast] = reserves as [bigint, bigint, number];
      return NextResponse.json(
        {
          success: true,
          data: {
            reserve0: reserve0.toString(),
            reserve1: reserve1.toString(),
            blockTimestampLast,
            token0,
            token1,
            rpcUrl: url,
            network,
          },
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        }
      );
    } catch (e: any) {
      lastError = e?.message || String(e);
      continue;
    }
  }
  return NextResponse.json(
    { success: false, error: '所有 RPC 节点请求失败', detail: lastError, network },
    { status: 500 }
  );
}