import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, Hex, parseEther, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { getPrivateKeyFromDatabase, parseBlockchainError } from '@/lib/serverUtils';

// ERC20 ABI - 只需要转账相关的函数
const ERC20_ABI = [
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
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
];

/**
 * POST /api/transfer
 * 执行代币转账（使用私钥签名）
 */
export async function POST(request: NextRequest) {
  console.log('========== 收到转账请求 ==========');
  try {
    const body = await request.json();
    console.log('请求体:', body);
    const { fromAddress, toAddress, amount, tokenAddress } = body;

    if (!fromAddress || !toAddress || !amount) {
      console.error('❌ 缺少必要参数');
      return NextResponse.json(
        { success: false, error: '缺少必要参数: fromAddress, toAddress, amount' },
        { status: 400 }
      );
    }
    
    console.log('✅ 参数验证通过');
    console.log('- 发送方:', fromAddress);
    console.log('- 接收方:', toAddress);
    console.log('- 数量:', amount);
    console.log('- 代币地址:', tokenAddress || 'BNB (原生代币)');

    // 1. 从数据库获取私钥
    const privateKey = await getPrivateKeyFromDatabase(fromAddress);
    if (!privateKey) {
      console.error('❌ 无法获取私钥');
      return NextResponse.json(
        { success: false, error: `账户 ${fromAddress} 的私钥不存在，请确保该账户已导入` },
        { status: 400 }
      );
    }

    // 2. 创建账户和客户端
    const rpcUrl = process.env.ANVIL_RPC_URL || 'http://anvil-api:8545';
    const account = privateKeyToAccount(privateKey as Hex);
    
    // 配置 HTTP transport
    const transport = http(rpcUrl, {
      timeout: 30000, // 30秒超时
      retryCount: 3,
      retryDelay: 1000,
      fetchOptions: {
        keepalive: true,
      },
    });
    
    const publicClient = createPublicClient({
      chain: bsc,
      transport,
    });
    
    const walletClient = createWalletClient({
      account,
      chain: bsc,
      transport,
    });

    console.log('✅ 成功创建 wallet client，账户地址:', account.address);

    if (!tokenAddress) {
      // 转账原生代币（BNB）
      console.log('开始 BNB 转账...');
      
      try {
        const amountInWei = parseEther(amount);
        console.log('转账金额 (Wei):', amountInWei.toString());

        // 使用 viem 发送交易（会自动签名）
        const hash = await walletClient.sendTransaction({
          to: toAddress as Hex,
          value: amountInWei,
        });

        console.log('✅ 交易已发送, 哈希:', hash);

        // 🚀 立即返回 hash，不等待确认
        // 用户可以使用 cast 工具查看交易状态：
        // cast tx <hash> --rpc-url http://anvil-api:8545
        // cast receipt <hash> --rpc-url http://anvil-api:8545
        
        // 异步后台等待确认（不阻塞响应）
        publicClient.waitForTransactionReceipt({ hash }).then((receipt) => {
          console.log('✅ 交易已确认, 哈希:', hash);
          console.log('交易回执状态:', receipt.status);
          console.log('Gas 使用:', receipt.gasUsed.toString());
          
          if (receipt.status === 'reverted') {
            console.error('❌ 交易被 revert:', hash);
          }
        }).catch((err) => {
          console.error('❌ 等待交易确认时出错:', err);
        });

        return NextResponse.json({
          success: true,
          message: `BNB 转账交易已提交`,
          txHash: hash,
          tip: `使用 cast tx ${hash} --rpc-url http://anvil-api:8545 查看交易详情`,
        });
      } catch (error: any) {
        console.error('❌ BNB 转账失败:', error);
        throw error; // 抛出原始错误以便统一处理
      }
    } else {
      // ERC20 代币转账
      console.log('开始 ERC20 代币转账...');
      
      try {
        // 1. 获取代币精度
        const decimals = await publicClient.readContract({
          address: tokenAddress as Hex,
          abi: ERC20_ABI,
          functionName: 'decimals',
        }) as number;
        
        console.log('代币精度:', decimals);

        // 2. 转换金额
        const amountInWei = parseUnits(amount, decimals);
        console.log('转账金额 (最小单位):', amountInWei.toString());

        // 3. 调用 transfer 函数（viem 会自动签名）
        const hash = await walletClient.writeContract({
          address: tokenAddress as Hex,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [toAddress as Hex, amountInWei],
        });

        console.log('✅ 交易已发送, 哈希:', hash);

        // 🚀 立即返回 hash，不等待确认
        // 用户可以使用 cast 工具查看交易状态：
        // cast tx <hash> --rpc-url http://anvil-api:8545
        // cast receipt <hash> --rpc-url http://anvil-api:8545
        
        // 异步后台等待确认（不阻塞响应）
        publicClient.waitForTransactionReceipt({ hash }).then((receipt) => {
          console.log('✅ 交易已确认, 哈希:', hash);
          console.log('交易回执状态:', receipt.status);
          console.log('Gas 使用:', receipt.gasUsed.toString());
          console.log('事件日志数量:', receipt.logs.length);
          
          if (receipt.status === 'reverted') {
            console.error('❌ 交易被 revert:', hash);
          }
        }).catch((err) => {
          console.error('❌ 等待交易确认时出错:', err);
        });

        return NextResponse.json({
          success: true,
          message: `ERC20 代币转账交易已提交`,
          txHash: hash,
          tip: `使用 cast tx ${hash} --rpc-url http://anvil-api:8545 查看交易详情`,
        });
      } catch (err: any) {
        console.error('❌ ERC20 转账失败:', err);
        throw err; // 抛出原始错误以便统一处理
      }
    }
  } catch (error) {
    console.error('❌ 转账失败:', error);
    
    // 使用统一的错误解读函数
    const friendlyErrorMessage = parseBlockchainError(error);
    console.error('解读后的错误:', friendlyErrorMessage);
    
    return NextResponse.json(
      { success: false, error: friendlyErrorMessage },
      { status: 500 }
    );
  }
}
