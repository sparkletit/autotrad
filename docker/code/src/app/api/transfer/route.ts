import { NextRequest } from 'next/server';
import { createPublicClient, createWalletClient, http, Hex, parseEther, parseUnits, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { getPrivateKeyFromDatabase, getRpcUrl, ok, fail } from '@/lib/serverUtils';

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
      return fail('缺少必要参数: fromAddress, toAddress, amount', 400);
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
      return fail(`账户 ${fromAddress} 的私钥不存在，请确保该账户已导入`, 400);
    }

    // 2. 创建账户和客户端
    const rpcUrl = getRpcUrl('fork');
    const account = privateKeyToAccount(privateKey as Hex);
    
    // 配置 HTTP transport
    const transport = http(rpcUrl, {
      timeout: 70000, // 70秒超时（比业务超时1分钟稍长，确保能捕获到超时错误）
      retryCount: 2, // 减少重试次数，避免重复超时
      retryDelay: 500, // 快速重试
      fetchOptions: {
        keepalive: true,
      },
    });
    
    console.log('✅ RPC URL:', rpcUrl);
    console.log('✅ 连接测试...');
    
    // 先测试 RPC 连接是否正常
    try {
      const testClient = createPublicClient({ chain: bsc, transport: http(rpcUrl, { timeout: 10000 }) });
      const chainId = await testClient.getChainId();
      console.log('✅ RPC 连接正常，Chain ID:', chainId);
    } catch (err) {
      console.error('❌ RPC 连接失败:', err);
      throw new Error(`无法连接到 RPC: ${rpcUrl}. 请确保 Fork 网络已启动。`);
    }
    
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

        // 先检查是否有 pending 交易
        console.log('📊 步骤 1: 检查 pending 交易...');
        const checkStart = Date.now();
        let pendingNonce: number;
        let latestNonce: number;
        let nonce: number | undefined;
        
        try {
          // 获取 pending 和 latest nonce
          [pendingNonce, latestNonce] = await Promise.all([
            Promise.race([
              publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('获取 pending nonce 超时（5秒）')), 5000)
              ),
            ]) as Promise<number>,
            Promise.race([
              publicClient.getTransactionCount({ address: account.address, blockTag: 'latest' }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('获取 latest nonce 超时（5秒）')), 5000)
              ),
            ]) as Promise<number>,
          ]);
          
          console.log(`✅ Pending Nonce: ${pendingNonce}, Latest Nonce: ${latestNonce}, 耗时: ${Date.now() - checkStart}ms`);
          
          // 如果有 pending 交易（pendingNonce > latestNonce），不再尝试触发挖矿，直接继续使用 pending nonce
          if (pendingNonce > latestNonce) {
            const pendingCount = pendingNonce - latestNonce;
            console.warn(`⚠️ 检测到 ${pendingCount} 笔 pending 交易，直接使用 pending nonce 继续发送当前交易。`);
          }
          
          // 使用 pending nonce（如果没有 pending 交易，pendingNonce === latestNonce）
          nonce = pendingNonce;
          console.log(`✅ 将使用 nonce: ${nonce}`);
        } catch (err: any) {
          // 对于 pending 检查相关错误，不再抛出，记录警告并尝试 latest nonce
          if (err.message?.includes('未确认的交易') || err.message?.includes('pending')) {
            console.warn('⚠️ 获取 nonce 时检测到 pending 异常，尝试使用 latest nonce 继续:', err);
          }
          // 其他错误，尝试使用 latest nonce
          console.warn('⚠️ 获取 nonce 时出错，尝试使用 latest nonce:', err);
          try {
            latestNonce = await Promise.race([
              publicClient.getTransactionCount({ address: account.address, blockTag: 'latest' }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('获取 nonce 超时（5秒）')), 5000)
              ),
            ]) as number;
            nonce = latestNonce; // 如果 pending 获取失败，回退到 latest nonce
          } catch (fallbackErr) {
            console.error('❌ 获取 nonce 失败（latest）:', fallbackErr);
            console.warn('⚠️ 将不指定 nonce，交由 viem 自动处理');
            nonce = undefined; // 让 viem 自动获取 nonce，避免因 nonce 获取失败而中止
          }
        }
        
        // 优先尝试 gas 估算，如果超时则使用固定 gas 值
        console.log('📊 步骤 2: 尝试估算 gas...');
        let gasLimit: bigint;
        const gasEstimateStart = Date.now();
        try {
          gasLimit = await Promise.race([
            publicClient.estimateGas({
              account,
              to: toAddress as Hex,
              value: amountInWei,
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Gas 估算超时（8秒）')), 8000)
            ),
          ]) as bigint;
          console.log(`✅ Gas 估算成功: ${gasLimit.toString()}, 耗时: ${Date.now() - gasEstimateStart}ms`);
        } catch (err) {
          // Gas 估算失败或超时，使用固定值
          gasLimit = BigInt(8000000);
          console.warn(`⚠️ Gas 估算失败，使用固定值: ${gasLimit.toString()}, 耗时: ${Date.now() - gasEstimateStart}ms`, err);
        }

        // 发送交易（手动指定 nonce，避免 viem 自动获取导致的延迟）
        console.log(`📤 步骤 3: 正在发送交易（gas: ${gasLimit.toString()}, nonce: ${nonce ?? 'auto'}）...`);
        const startTime = Date.now();
        
        // 使用 Promise.race 实现超时控制
        let hash: Hex;
        try {
          const txOptions: any = {
            to: toAddress as Hex,
            value: amountInWei,
            gas: gasLimit,
          };
          if (typeof nonce === 'number') txOptions.nonce = nonce; // 仅在可用时指定 nonce
          hash = await walletClient.sendTransaction(txOptions);
        } catch (err: any) {
          const elapsed = Date.now() - startTime;
          console.error(`❌ 交易发送失败，耗时: ${elapsed}ms`, err);
          // 返回原始错误（由外层捕获统一返回）
          throw err;
        }

        const elapsed = Date.now() - startTime;
        console.log(`✅ 交易已发送, 哈希: ${hash}, 耗时: ${elapsed}ms`);

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

        return ok({
          message: `BNB 转账交易已提交`,
          txHash: hash,
          tip: `使用 cast tx ${hash} --rpc-url ${rpcUrl} 查看交易详情`,
        });
      } catch (error: any) {
        console.error('❌ BNB 转账失败:', error);
        // 返回原始错误（由外层捕获统一返回）
        throw error;
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

        // 3. 先检查是否有 pending 交易
        console.log('📊 步骤 1: 检查 pending 交易...');
        const checkStart = Date.now();
        let pendingNonce: number;
        let latestNonce: number;
        let nonce: number | undefined;
        
        try {
          // 获取 pending 和 latest nonce
          [pendingNonce, latestNonce] = await Promise.all([
            Promise.race([
              publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('获取 pending nonce 超时（5秒）')), 5000)
              ),
            ]) as Promise<number>,
            Promise.race([
              publicClient.getTransactionCount({ address: account.address, blockTag: 'latest' }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('获取 latest nonce 超时（5秒）')), 5000)
              ),
            ]) as Promise<number>,
          ]);
          
          console.log(`✅ Pending Nonce: ${pendingNonce}, Latest Nonce: ${latestNonce}, 耗时: ${Date.now() - checkStart}ms`);
          
          // 如果有 pending 交易（pendingNonce > latestNonce），不再尝试触发挖矿，直接继续使用 pending nonce
          if (pendingNonce > latestNonce) {
            const pendingCount = pendingNonce - latestNonce;
            console.warn(`⚠️ 检测到 ${pendingCount} 笔 pending 交易，直接使用 pending nonce 继续发送当前交易。`);
          }
          
          // 使用 pending nonce（如果没有 pending 交易，pendingNonce === latestNonce）
          nonce = pendingNonce;
          console.log(`✅ 将使用 nonce: ${nonce}`);
        } catch (err: any) {
          // 对于 pending 检查相关错误，不再抛出，记录警告并尝试 latest nonce
          if (err.message?.includes('未确认的交易') || err.message?.includes('pending')) {
            console.warn('⚠️ 获取 nonce 时检测到 pending 异常，尝试使用 latest nonce 继续:', err);
          }
          // 其他错误，尝试使用 latest nonce
          console.warn('⚠️ 获取 nonce 时出错，尝试使用 latest nonce:', err);
          try {
            latestNonce = await Promise.race([
              publicClient.getTransactionCount({ address: account.address, blockTag: 'latest' }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('获取 nonce 超时（5秒）')), 5000)
              ),
            ]) as number;
            nonce = latestNonce; // 如果 pending 获取失败，回退到 latest nonce
          } catch (fallbackErr) {
            console.error('❌ 获取 nonce 失败（latest）:', fallbackErr);
            console.warn('⚠️ 将不指定 nonce，交由 viem 自动处理');
            nonce = undefined; // 让 viem 自动获取 nonce，避免因 nonce 获取失败而中止
          }
        }
        
        // 4. 优先尝试 gas 估算，如果超时则使用固定 gas 值
        console.log('📊 步骤 2: 尝试估算 gas...');
        let gasLimit: bigint;
        const gasEstimateStart = Date.now();
        try {
          gasLimit = await Promise.race([
            publicClient.estimateGas({
              account,
              to: tokenAddress as Hex,
              data: encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [toAddress as Hex, amountInWei],
              }),
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Gas 估算超时（3秒）')), 3000)
            ),
          ]) as bigint;
          console.log(`✅ Gas 估算成功: ${gasLimit.toString()}, 耗时: ${Date.now() - gasEstimateStart}ms`);
        } catch (err) {
          // Gas 估算失败或超时，使用固定值
          gasLimit = BigInt(8000000);
          console.warn(`⚠️ Gas 估算失败，使用固定值: ${gasLimit.toString()}, 耗时: ${Date.now() - gasEstimateStart}ms`, err);
        }

        // 5. 调用 transfer 函数（手动指定 nonce，避免 viem 自动获取导致的延迟）
        console.log(`📤 步骤 3: 正在发送 ERC20 转账交易（gas: ${gasLimit.toString()}, nonce: ${nonce ?? 'auto'}）...`);
        const startTime = Date.now();
        
        // 使用 Promise.race 实现超时控制
        let hash: Hex;
        try {
          const writeOptions: any = {
            address: tokenAddress as Hex,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [toAddress as Hex, amountInWei],
            gas: gasLimit,
          };
          if (typeof nonce === 'number') writeOptions.nonce = nonce; // 仅在可用时指定 nonce
          hash = await walletClient.writeContract(writeOptions);
        } catch (err: any) {
          const elapsed = Date.now() - startTime;
          console.error(`❌ ERC20 交易发送失败，耗时: ${elapsed}ms`, err);
          // 返回原始错误（由外层捕获统一返回）
          throw err;
        }

        const elapsed = Date.now() - startTime;
        console.log(`✅ 交易已发送, 哈希: ${hash}, 耗时: ${elapsed}ms`);

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

        return ok({
          message: `ERC20 代币转账交易已提交`,
          txHash: hash,
          tip: `使用 cast tx ${hash} --rpc-url ${rpcUrl} 查看交易详情`,
        });
      } catch (err: any) {
        console.error('❌ ERC20 转账失败:', err);
        // 返回原始错误（由外层捕获统一返回）
        throw err;
      }
    }
  } catch (error: any) {
    console.error('❌ 转账失败:', error);
    const rawMessage = typeof error === 'string' ? error : (error?.message || String(error));
    return fail(rawMessage, 500);
  }
}
