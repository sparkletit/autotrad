import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, Hex, parseEther, getContract } from 'viem';

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
 * 执行代币转账（在Anvil Fork网络中）
 * 
 * 注：因为Anvil是开发网络，不需要于签名二是用anvil提供的RPC方法直接修改余额
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromAddress, toAddress, amount, tokenAddress } = body;

    if (!fromAddress || !toAddress || !amount) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: fromAddress, toAddress, amount' },
        { status: 400 }
      );
    }

    const rpcUrl = 'http://host.docker.internal:8545';
    const amountInWei = parseEther(amount);

    if (!tokenAddress) {
      // 转账原生代币（BNB）
      // 执行真实的交易，不使用任何模拟方法
      
      // 第1步：验证发送方余额是否足够
      const getFromBalanceResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [fromAddress, 'latest'],
          id: 1,
        }),
      });

      const balanceResult = await getFromBalanceResponse.json();
      if (balanceResult.error) {
        throw new Error('获取发送方余额失败');
      }

      const currentBalance = BigInt(balanceResult.result);
      if (currentBalance < amountInWei) {
        throw new Error('发送方余额不足');
      }

      // 第2步：获取账户的 nonce（用于交易排序）
      const getNonceResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionCount',
          params: [fromAddress, 'latest'],
          id: 2,
        }),
      });

      const nonceResult = await getNonceResponse.json();
      if (nonceResult.error) {
        throw new Error('获取 nonce 失败');
      }
      const nonce = nonceResult.result;

      // 第3步：获取当前 gas 价格
      const gasPriceResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          id: 3,
        }),
      });

      const gasPriceResult = await gasPriceResponse.json();
      if (gasPriceResult.error) {
        throw new Error('获取 gas 价格失败');
      }
      const gasPrice = gasPriceResult.result;

      // 第3.5步：预估 gas（而不是固定值）
      let gasLimit = '0x7530'; // 默认 30000 gas
      try {
        const estimateGasResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_estimateGas',
            params: [
              {
                from: fromAddress,
                to: toAddress,
                value: '0x' + amountInWei.toString(16),
              },
            ],
            id: 35,
          }),
        });

        const estimateResult = await estimateGasResponse.json();
        if (estimateResult.result) {
          const estimated = BigInt(estimateResult.result);
          // 使用预估值 * 1.5 作为 gas limit
          const gasWithBuffer = (estimated * BigInt(150)) / BigInt(100);
          gasLimit = '0x' + gasWithBuffer.toString(16);
          console.log(`BNB 转账 Gas 预估: ${estimated.toString()}, 实际 Gas Limit (预估*1.5): ${gasWithBuffer.toString()}`);
        } else if (estimateResult.error) {
          console.warn('Gas 预估失败，使用默认值 30000:', estimateResult.error);
        }
      } catch (err) {
        console.warn('Gas 预估异常，使用默认值 30000:', err);
      }

      // 第4步：执行真实的转账交易
      const txResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_sendTransaction',
          params: [
            {
              from: fromAddress,
              to: toAddress,
              value: '0x' + amountInWei.toString(16),
              gas: gasLimit, // 使用动态一估殗的 gas
              gasPrice: gasPrice,
              nonce: nonce,
            },
          ],
          id: 4,
        }),
      });

      const txResult = await txResponse.json();
      if (txResult.error) {
        throw new Error(`转账交易发送失败: ${txResult.error.message}`);
      }

      const txHash = txResult.result;
      if (!txHash) {
        throw new Error('无法获取交易哈希');
      }

      // 第5步：等待交易完成并获取交易回执
      let receipt = null;
      let retries = 0;
      const maxRetries = 30;

      while (!receipt && retries < maxRetries) {
        const receiptResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionReceipt',
            params: [txHash],
            id: 5 + retries,
          }),
        });

        const receiptResult = await receiptResponse.json();
        if (receiptResult.result) {
          receipt = receiptResult.result;
        } else {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }
      }

      if (!receipt) {
        throw new Error('无法获取交易回执：交易可能未完成');
      }

      if (receipt.status === '0x0' || receipt.status === 0) {
        throw new Error('转账交易失败：交易被 revert');
      }

      if (receipt.status !== '0x1' && receipt.status !== 1) {
        throw new Error(`交易状态异常：${receipt.status}`);
      }

      return NextResponse.json({
        success: true,
        message: `成功转账 ${amount} BNB 从 ${fromAddress} 到 ${toAddress}`,
        txHash,
      });
    } else {
      // ERC20 代币转账
      try {
        // 需要获取代币的 decimals 信息
        const decimalsResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [
              {
                to: tokenAddress,
                data: '0x313ce567', // decimals() 函数签名
              },
              'latest',
            ],
            id: 10,
          }),
        });

        const decimalsResult = await decimalsResponse.json();
        let decimals = 18; // 默认 18
        
        if (decimalsResult.result && decimalsResult.result !== '0x') {
          decimals = parseInt(decimalsResult.result, 16);
        }

        // 计算实际的转账数量（以最小单位）
        // 注意：amount 是用户输入的字符串，需要转换为 BigInt
        const amountBigInt = BigInt(Math.floor(parseFloat(amount) * (10 ** decimals)));
        const amountHex = amountBigInt.toString(16).padStart(64, '0');

        // 构建 transfer(to, amount) 函数调用
        // transfer(address to, uint256 amount) 的 keccak256 签名前 4 bytes 是 0xa9059cbb
        const transferFunctionSelector = '0xa9059cbb';
        
        // 编码参数
        const toAddressHex = toAddress.slice(2).padStart(64, '0');
        const transferData = transferFunctionSelector + toAddressHex + amountHex;

        // 第1步：模拟转账检查是否可以执行
        const callResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [
              {
                from: fromAddress,
                to: tokenAddress,
                data: transferData,
              },
              'latest',
            ],
            id: 11,
          }),
        });

        const callResult = await callResponse.json();
        if (callResult.error) {
          throw new Error('ERC20 转账调用失败: ' + (callResult.error.message || '未知错误'));
        }

        // 第1.5步：预估 Gas 需求
        const estimateGasResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_estimateGas',
            params: [
              {
                from: fromAddress,
                to: tokenAddress,
                data: transferData,
              },
            ],
            id: 115, // 使用整数 ID 而不是小数
          }),
        });

        const estimateResult = await estimateGasResponse.json();
        let gasLimit = BigInt(500000); // 伏算值会失败时，默认为 500k gas

        if (estimateResult.result) {
          // 使用预估值乘以 1.5 (增加到 50% 余量) 作为实际 gas 限制
          const estimatedGas = BigInt(estimateResult.result);
          gasLimit = (estimatedGas * BigInt(150)) / BigInt(100); // 乘以 1.5
          console.log(`预估 Gas: ${estimatedGas.toString()}, 实际 Gas 限制: ${gasLimit.toString()}`);
        } else if (estimateResult.error) {
          console.log('预估 Gas 失败，使用默认值 (500k): ', estimateResult.error.message);
        }

        // 第2步：执行实际转账（通过 eth_sendTransaction）
        const txResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_sendTransaction',
            params: [
              {
                from: fromAddress,
                to: tokenAddress,
                data: transferData,
                gas: '0x' + gasLimit.toString(16), // 使用预估的 gas
              },
            ],
            id: 13,
          }),
        });

        const txResult = await txResponse.json();
        if (txResult.error) {
          // 交易执行失败，直接抱告错误
          throw new Error(`交易发送失败: ${txResult.error.message || '未知错误'}`);
        }

        const txHash = txResult.result;
        if (!txHash) {
          throw new Error('无法获取交易哈希');
        }

        // 第3步：等待交易完成并检查交易回执
        // 使用 eth_getTransactionReceipt 获取交易回执
        let receipt = null;
        let retries = 0;
        const maxRetries = 30; // 最多重试 30 次

        while (!receipt && retries < maxRetries) {
          const receiptResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getTransactionReceipt',
              params: [txHash],
              id: 14 + retries,
            }),
          });

          const receiptResult = await receiptResponse.json();
          if (receiptResult.result) {
            receipt = receiptResult.result;
          } else {
            // 交易还未完成，稍后重试
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }
        }

        // 验证交易是否成功
        if (!receipt) {
          throw new Error('无法获取交易回执：交易可能未完成');
        }

        if (receipt.status === '0x0' || receipt.status === 0) {
          // 交易被 revert，门梨原因
          // 检查 gasUsed 是否等于 gasLimit（OutOfGas的一个信号）
          const gasUsed = receipt.gasUsed ? BigInt(receipt.gasUsed) : BigInt(0);
          if (gasUsed.toString() === gasLimit.toString()) {
            throw new Error('交易执行失败: OutOfGas - 需要更多的 Gas，请稍后重试');
          } else {
            throw new Error('交易执行失败：合约调用被 revert（可能原因：余额不足、授权不足或其他合约错误）');
          }
        }

        if (receipt.status !== '0x1' && receipt.status !== 1) {
          throw new Error(`交易状态异常：${receipt.status}`);
        }

        return NextResponse.json({
          success: true,
          message: `成功转账自定义代币 (${tokenAddress}) 从 ${fromAddress} 到 ${toAddress}`,
          txHash,
        });
      } catch (err) {
        console.error('ERC20 转账失败:', err);
        throw new Error(`ERC20 转账失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    }
  } catch (error) {
    console.error('转账失败:', error);
    const errorMessage = error instanceof Error ? error.message : '转账失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
