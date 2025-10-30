import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseEther, formatEther } from 'viem';
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

// WBNB 地址（不同网络）
const WBNB_ADDRESSES: Record<string, Hex> = {
  fork: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  bsc: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  polygon: '0x9c68a8c77e748b94d1da59f6f738a1c9df5fdcd4',
};

// WBNB ABI - 获取余额
const WBNB_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * POST /api/swap/wrap-wbnb
 * 在链上真实执行 BNB → WBNB 包装操作
 * 调用 WBNB 合约（0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c）的 deposit() 方法
 * 并发送 BNB 作为交易的 value
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, amount, network = 'fork' } = body;

    // 参数验证
    if (!account || !amount) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：account, amount' },
        { status: 400 }
      );
    }

    // 验证账户地址格式
    if (!account.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { success: false, error: '无效的账户地址格式' },
        { status: 400 }
      );
    }

    const rpcUrl = getRpcUrl(network);
    const publicClient = createPublicClient({ transport: http(rpcUrl) });

    // 转换金额为 Wei
    let amountInWei: bigint;
    try {
      amountInWei = parseEther(amount.toString());
    } catch (err) {
      return NextResponse.json(
        { success: false, error: '无效的金额格式' },
        { status: 400 }
      );
    }

    // 检查账户 BNB 余额
    const bnbBalance = await publicClient.getBalance({ address: account as Hex });
    
    if (bnbBalance < amountInWei) {
      return NextResponse.json(
        {
          success: false,
          error: `账户余额不足。当前余额: ${formatEther(bnbBalance)} BNB，需要: ${amount} BNB`,
        },
        { status: 400 }
      );
    }

    // 获取 WBNB 地址
    const wbnbAddress = WBNB_ADDRESSES[network] || WBNB_ADDRESSES.fork;

    // 如果是 fork 网络，执行真实的链上交易
    if (network === 'fork') {
      try {
        // 读取交易前的 BNB 和 WBNB 余额
        const bnbBalanceBefore = await publicClient.getBalance({ address: account as Hex });
        let wbnbBalanceBefore = BigInt(0);
        try {
          const result = await publicClient.readContract({
            address: wbnbAddress,
            abi: WBNB_ABI,
            functionName: 'balanceOf',
            args: [account as Hex],
          });
          wbnbBalanceBefore = result as bigint;
        } catch (err) {
          console.warn('读取交易前 WBNB 余额失败:', err);
        }
        console.log('交易前余额:');
        console.log('- BNB:', formatEther(bnbBalanceBefore));
        console.log('- WBNB:', formatEther(wbnbBalanceBefore));

        // 第一步：模拟账户，使其能与上执行交易
        const impersonateResponse = await fetch('http://host.docker.internal:8888/api/fork/impersonate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: account }),
        });

        const impersonateData = await impersonateResponse.json();
        if (!impersonateData.success) {
          console.warn('模拟账户失败，继续尝试执行交易:', impersonateData.error);
        }

        // 第二步：调用 WBNB 合约的 deposit() 方法
        // deposit() 函数选择器是 0xd0e30db0（无参数）
        const data = '0xd0e30db0';
        const valueInHex = `0x${amountInWei.toString(16)}`;

        console.log('准备执行 WBNB 包装交易:');
        console.log('- 账户:', account);
        console.log('- WBNB 地址:', wbnbAddress);
        console.log('- 金额 (Wei):', amountInWei.toString());
        console.log('- 金额 (Hex):', valueInHex);
        console.log('- 函数数据:', data);

        // 如果是 auto，先预估 gas
        let actualGas = '0x30000'; // 默认 196608 gas
        try {
          const estimatedGas = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_estimateGas',
              params: [{
                from: account,
                to: wbnbAddress,
                data: data,
                value: valueInHex,
              }],
              id: 1,
            }),
          });
          const gasResult = await estimatedGas.json();
          if (gasResult.result) {
            const estimated = BigInt(gasResult.result);
            const gasWithBuffer = (estimated * BigInt(120)) / BigInt(100); // 预估值 * 1.2
            actualGas = `0x${gasWithBuffer.toString(16)}`;
            console.log('Gas 预估:', estimated.toString());
            console.log('Gas 实际 (预估*1.2):', gasWithBuffer.toString());
          }
        } catch (estimateError) {
          console.warn('Gas 预估失败，使用默认值:', estimateError);
        }

        // 使用 eth_sendTransaction 在 fork 链上真实执行交易
        // Anvil 会自动为指定的 from 地址签署交易
        const txResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_sendTransaction',
            params: [
              {
                from: account,
                to: wbnbAddress,
                data: data,
                value: valueInHex,
                gas: actualGas, // 使用预估值 * 1.2
              },
            ],
            id: 1,
          }),
        });

        const result = await txResponse.json();
        console.log('交易响应:', result);
        
        if (result.error) {
          console.error('交易执行错误:', result.error);
          // 如果是 "No Signer available" 错误，提示用户
          if (result.error.message && result.error.message.includes('No Signer')) {
            throw new Error('Anvil fork 没有可用的签名者。请确保使用了正确的账户地址，或使用 anvil_impersonateAccount 模拟账户');
          }
          throw new Error(result.error.message || '执行交易失败');
        }

        const txHash = result.result;
        console.log('交易哈希:', txHash);

        // 等待交易确认（延长超时时间到 30 秒）
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ 
            hash: txHash as Hex,
            timeout: 30000 // 30秒超时
          });
          console.log('交易确认:', receipt.status);
          
          if (receipt.status !== 'success') {
            throw new Error('交易执行失败');
          }
        } catch (receiptError) {
          console.warn('等待交易确认超时:', receiptError);
          // 在 Anvil 中，交易通常会立即确认
          // 超时可能是网络问题，但交易可能已经成功
          console.log('继续读取余额验证交易是否成功...');
        }

        // 读取包装后的 WBNB 余额
        let wbnbBalanceAfter = BigInt(0);
        let bnbBalanceAfter = BigInt(0);
        try {
          const balanceResult = await publicClient.readContract({
            address: wbnbAddress,
            abi: WBNB_ABI,
            functionName: 'balanceOf',
            args: [account as Hex],
          });
          wbnbBalanceAfter = balanceResult as bigint;
          bnbBalanceAfter = await publicClient.getBalance({ address: account as Hex });
        } catch (err) {
          console.warn('读取 WBNB 余额失败:', err);
        }

        console.log('交易后余额:');
        console.log('- BNB:', formatEther(bnbBalanceAfter));
        console.log('- WBNB:', formatEther(wbnbBalanceAfter));
        console.log('余额变化:');
        console.log('- BNB 减少:', formatEther(bnbBalanceBefore - bnbBalanceAfter));
        console.log('- WBNB 增加:', formatEther(wbnbBalanceAfter - wbnbBalanceBefore));

        return NextResponse.json({
          success: true,
          data: {
            txHash,
            account,
            amountBNB: amount,
            amountWBNB: amount,
            wbnbAddress,
            network,
            timestamp: new Date().toISOString(),
            message: `成功将 ${amount} BNB 包装为 WBNB`,
            balances: {
              wbnb: {
                after: formatEther(wbnbBalanceAfter),
              },
            },
          },
        });
      } catch (error) {
        console.error('执行 WBNB 包装交易失败:', error);
        return NextResponse.json(
          {
            success: false,
            error: error instanceof Error ? error.message : '执行交易失败',
          },
          { status: 500 }
        );
      }
    }

    // 对于其他网络，返回需要签名的信息
    return NextResponse.json({
      success: true,
      data: {
        account,
        amountBNB: amount,
        wbnbAddress,
        message: '在真实网络上包装 WBNB 需要钱包签名',
        network,
      },
    });
  } catch (error) {
    console.error('包装 WBNB 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '包装 WBNB 失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/swap/wrap-wbnb/balance
 * 获取账户 BNB 和 WBNB 余额
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get('account');
    const network = searchParams.get('network') || 'fork';

    if (!account) {
      return NextResponse.json(
        { success: false, error: '缺少参数：account' },
        { status: 400 }
      );
    }

    const rpcUrl = getRpcUrl(network);
    const publicClient = createPublicClient({ transport: http(rpcUrl) });

    // 获取 BNB 余额
    const bnbBalance = await publicClient.getBalance({ address: account as Hex });

    // WBNB 地址
    const wbnbAddress = (WBNB_ADDRESSES[network] || WBNB_ADDRESSES.fork) as Hex;

    // 获取 WBNB 余额
    let wbnbBalance = BigInt(0);
    try {
      const balanceResult = await publicClient.readContract({
        address: wbnbAddress,
        abi: WBNB_ABI,
        functionName: 'balanceOf',
        args: [account as Hex],
      });
      wbnbBalance = balanceResult as bigint;
    } catch (err) {
      console.warn('读取 WBNB 余额失败:', err);
    }

    return NextResponse.json({
      success: true,
      data: {
        account,
        network,
        bnb: {
          balance: bnbBalance.toString(),
          formatted: formatEther(bnbBalance),
        },
        wbnb: {
          balance: wbnbBalance.toString(),
          formatted: formatEther(wbnbBalance),
          address: wbnbAddress,
        },
      },
    });
  } catch (error) {
    console.error('获取余额失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取余额失败',
      },
      { status: 500 }
    );
  }
}
