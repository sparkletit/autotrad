import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { Hex } from 'viem';

const getRpcUrl = (network: string): string => {
  const rpcUrls: Record<string, string> = {
    fork: process.env.ANVIL_RPC_URL || 'http://anvil-api:8545',
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
  {
    constant: true,
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * POST /api/swap/get-reserves
 * 查询 Pair 合约的储备信息
 */
export async function POST(request: NextRequest) {
  let pairAddress = '';
  let network = 'fork';
  let account: string | undefined;

  try {
    const body = await request.json();
    // 规范化地址格式：转换为小写并确保 0x 前缀
    pairAddress = body.pairAddress?.toLowerCase();
    if (pairAddress && !pairAddress.startsWith('0x')) {
      pairAddress = '0x' + pairAddress;
    }
    network = body.network || 'fork';
    account = body.account?.toLowerCase();
    if (account && !account.startsWith('0x')) {
      account = '0x' + account;
    }

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
        { success: false, error: '无效的地址格式，应为 0x 开头的 40 个十六进制字符' },
        { status: 400 }
      );
    }

    const rpcUrl = getRpcUrl(network);
    const publicClient = createPublicClient({
      transport: http(rpcUrl, {
        batch: false,
      }),
    });

    console.log('查询 Pair 储备:');
    console.log('- RPC URL:', rpcUrl);
    console.log('- Pair 地址:', pairAddress);
    console.log('- 网络:', network);

    // 先检查地址是否存在（通过 getCode）
    let code: string | undefined;
    try {
      code = await publicClient.getCode({
        address: pairAddress as Hex,
      });
    } catch (codeError) {
      const codeErrorMsg = codeError instanceof Error ? codeError.message : '未知错误';
      console.error('getCode 调用失败:', codeErrorMsg);
      
      // 如果 getCode 失败，可能是地址不存在或网络问题
      if (codeErrorMsg.includes('empty reader set') || codeErrorMsg.includes('failed to get account')) {
        return NextResponse.json(
          {
            success: false,
            error: `地址 ${pairAddress} 在 ${network} 网络上不存在或无法访问。

可能原因：
1. 地址输入错误
2. Fork 网络未正确初始化该合约
3. 该地址不是一个有效的合约地址

建议：
- 确认地址是否在 ${network} 网络上有部署
- 检查 Fork 网络是否已正确同步
- 使用已知的有效 Pair 合约地址`,
            details: {
              pairAddress,
              network,
              rpcUrl,
              suggestion: '可以尝试在 BSC 或其他网络上查询该地址',
            },
          },
          { status: 400 }
        );
      }
      throw codeError;
    }

    console.log('- 合约代码长度:', code?.length || 0);
    if (!code || code === '0x') {
      return NextResponse.json(
        {
          success: false,
          error: `地址 ${pairAddress} 在 ${network} 网络上没有合约代码。可能原因：
1. 这个地址不是一个合约地址（可能是一个普通账户）
2. 合约未部署到 ${network} 网络
3. Fork 网络配置不正确\n\n建议：
- 确认这是一个 Pair 合约地址
- 验证该合约是否存在于 ${network} 网络
- 检查地址是否正确`,
          details: {
            pairAddress,
            network,
            rpcUrl,
            hasCode: code && code !== '0x',
            codeLength: code?.length || 0,
          },
        },
        { status: 400 }
      );
    }

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

    const [reserve0, reserve1, blockTimestampLast] = reserves as [
      bigint,
      bigint,
      number
    ];

    // 如果提供了账户地址，查询LP余额
    let lpBalance = '0';
    if (account && account.match(/^0x[a-fA-F0-9]{40}$/)) {
      try {
        const balance = await publicClient.readContract({
          address: pairAddress as Hex,
          abi: PAIR_ABI,
          functionName: 'balanceOf',
          args: [account as Hex],
        }) as bigint;
        lpBalance = balance.toString();
        console.log('- LP余额:', lpBalance);
      } catch (balanceError) {
        console.warn('查询LP余额失败:', balanceError);
        // 如果查询失败，lpBalance保持为'0'
      }
    }

    console.log('储备查询成功:');
    console.log('- Token0:', token0);
    console.log('- Reserve0:', reserve0.toString());
    console.log('- Token1:', token1);
    console.log('- Reserve1:', reserve1.toString());
    console.log('- Block Timestamp:', blockTimestampLast);
    if (account) {
      console.log('- 账户:', account);
      console.log('- LP余额:', lpBalance);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          reserve0: reserve0.toString(),
          reserve1: reserve1.toString(),
          blockTimestampLast,
          token0: token0 as string,
          token1: token1 as string,
          lpBalance: lpBalance,
        },
      },
      {
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '查询储备失败';
    console.error('查询储备失败:', errorMessage);
    console.error('错误详情:', error);

    let userFriendlyError = errorMessage;
    let httpStatus = 500;

    if (
      errorMessage.includes('empty reader set') ||
      errorMessage.includes('failed to get account')
    ) {
      userFriendlyError = `无法访问合约 ${pairAddress}。可能原因：
1. 地址不是有效的 Pair 合约
2. Fork 网络尚未启动或不可用
3. 地址在 ${network} 网络上不存在`;
      httpStatus = 400;
    } else if (
      errorMessage.includes('connection refused') ||
      errorMessage.includes('ECONNREFUSED')
    ) {
      userFriendlyError = `RPC 节点连接失败：无法连接到 ${getRpcUrl(network)}
请检查：
1. Fork 网络是否已启动
2. RPC 地址是否正确`;
      httpStatus = 503;
    } else if (errorMessage.includes('invalid address')) {
      userFriendlyError = '无效的地址格式';
      httpStatus = 400;
    }

    return NextResponse.json(
      {
        success: false,
        error: userFriendlyError,
        rawError: errorMessage,
        details: {
          pairAddress,
          network,
          rpcUrl: getRpcUrl(network),
        },
      },
      {
        status: httpStatus,
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  }
}

/**
 * GET /api/swap/get-reserves?network=fork
 * 健康检查接口，验证 RPC 连接是否正常
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const network = searchParams.get('network') || 'fork';
    const rpcUrl = getRpcUrl(network);

    console.log(`健康检查 - 网络: ${network}, RPC: ${rpcUrl}`);

    const publicClient = createPublicClient({
      transport: http(rpcUrl, { batch: false }),
    });

    // 尝试获取当前区块号
    const blockNumber = await publicClient.getBlockNumber();
    console.log(`成功连接 ${network}，当前区块: ${blockNumber}`);

    return NextResponse.json(
      {
        success: true,
        network,
        rpcUrl,
        blockNumber: blockNumber.toString(),
        message: `${network} 网络 RPC 连接正常`,
      },
      {
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '健康检查失败';
    console.error('RPC 连接失败:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: `RPC 连接失败: ${errorMessage}`,
      },
      {
        status: 500,
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  }
}
