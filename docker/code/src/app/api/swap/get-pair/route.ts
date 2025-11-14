import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, getAddress } from 'viem';
import { getRpcUrl } from '@/lib/serverUtils';
import { bsc } from 'viem/chains';
import { Hex } from 'viem';


// PancakeSwap V2 Factory 地址（BSC 主网）- 使用小写避免校验失败
const FACTORY_ADDRESS = '0xca143ce32fe78f1f7019d7d551a6402fc5350c73';

// Factory ABI - getPair
const FACTORY_ABI = [
  {
    constant: true,
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    name: 'getPair',
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Pair ABI - 读取储备与 token0/token1
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

/**
 * POST /api/swap/get-pair
 * 根据 TokenA/TokenB 返回 Pair 地址及当前储备
 */
export async function POST(request: NextRequest) {
  let tokenA = '';
  let tokenB = '';
  let network = 'fork';
  try {
    const body = await request.json();
    tokenA = (body.tokenA || '').toLowerCase();
    tokenB = (body.tokenB || '').toLowerCase();
    if (tokenA && !tokenA.startsWith('0x')) tokenA = '0x' + tokenA;
    if (tokenB && !tokenB.startsWith('0x')) tokenB = '0x' + tokenB;
    network = body.network || 'fork';

    if (!tokenA || !tokenB) {
      return NextResponse.json(
        { success: false, error: '缺少参数：tokenA 或 tokenB' },
        { status: 400 }
      );
    }

    if (!tokenA.match(/^0x[a-fA-F0-9]{40}$/) || !tokenB.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { success: false, error: '地址格式无效，需为 0x 开头的 40 位十六进制' },
        { status: 400 }
      );
    }

    const rpcUrl = getRpcUrl(network);
    const publicClient = createPublicClient({
      chain: bsc,
      transport: http(rpcUrl, { batch: false }),
    });

    // 先验证 Factory 是否存在代码
    try {
      const factoryAddr = getAddress(FACTORY_ADDRESS);
      console.log('[get-pair] 使用 Factory 地址:', FACTORY_ADDRESS, '规范化为:', factoryAddr);
      const factoryCode = await publicClient.getCode({ address: factoryAddr as Hex });
      if (!factoryCode || factoryCode === '0x') {
        return NextResponse.json(
          {
            success: false,
            error: `Factory 合约在 ${network} 网络上不存在或未部署`,
            details: { FACTORY_ADDRESS, network, rpcUrl },
          },
          { status: 400 }
        );
      }
    } catch (codeError) {
      const msg = codeError instanceof Error ? codeError.message : '未知错误';
      // 常见 RPC 连接问题处理
      if (msg.includes('connection refused') || msg.includes('ECONNREFUSED')) {
        return NextResponse.json(
          {
            success: false,
            error: `RPC 节点连接失败：无法连接到 ${rpcUrl}`,
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: `无法读取 Factory 合约代码: ${msg}`,
          details: { FACTORY_ADDRESS, network, rpcUrl },
        },
        { status: 400 }
      );
    }

    // 查询 Pair 地址
    let pairAddress: string = '0x0000000000000000000000000000000000000000';
    try {
      const factoryAddr = getAddress(FACTORY_ADDRESS);
      const tokenAAddr = getAddress(tokenA);
      const tokenBAddr = getAddress(tokenB);
      console.log('[get-pair] 请求 getPair(', tokenAAddr, ',', tokenBAddr, ') via', factoryAddr, 'on', rpcUrl);
      pairAddress = await publicClient.readContract({
        address: factoryAddr as Hex,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [tokenAAddr as Hex, tokenBAddr as Hex],
      }) as string;
      console.log('[get-pair] 返回 pairAddress:', pairAddress);
    } catch (readError) {
      const msg = readError instanceof Error ? readError.message : '读取 Factory.getPair 失败';
      return NextResponse.json(
        {
          success: false,
          error: `查询 Pair 地址失败: ${msg}`,
          details: { tokenA, tokenB, FACTORY_ADDRESS, network, rpcUrl },
        },
        { status: 400 }
      );
    }

    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const exists = pairAddress && pairAddress.toLowerCase() !== zeroAddress;

    let token0: string | undefined;
    let token1: string | undefined;
    let reserve0: string | undefined;
    let reserve1: string | undefined;

    if (exists) {
      // 验证合约代码存在
      const code = await publicClient.getCode({ address: pairAddress as Hex });
      if (code && code !== '0x') {
        // 读取 token0/token1 与储备
        token0 = await publicClient.readContract({ address: pairAddress as Hex, abi: PAIR_ABI, functionName: 'token0' }) as string;
        token1 = await publicClient.readContract({ address: pairAddress as Hex, abi: PAIR_ABI, functionName: 'token1' }) as string;
        const reserves = await publicClient.readContract({ address: pairAddress as Hex, abi: PAIR_ABI, functionName: 'getReserves' }) as [bigint, bigint, number];
        reserve0 = reserves[0].toString();
        reserve1 = reserves[1].toString();
      } else {
        // Pair 地址没有代码（可能尚未创建），返回 exists false 的语义信息
        return NextResponse.json({
          success: true,
          data: {
            pairAddress,
            exists: false,
            token0: undefined,
            token1: undefined,
            reserve0: undefined,
            reserve1: undefined,
            network,
            rpcUrl,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        pairAddress,
        exists,
        token0,
        token1,
        reserve0,
        reserve1,
        network,
        rpcUrl,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '查询 Pair 失败';
    console.error('get-pair 错误:', msg, error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
