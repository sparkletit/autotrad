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
      // 使用Anvil的特殊方法：arvil_setBalance
      
      // 第1步：从发送方转出金析（减少发送方余额）
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

      // 第2步：修改发送方余额（减少）
      const newFromBalance = (currentBalance - amountInWei).toString(16);
      const setFromBalanceResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'anvil_setBalance',
          params: [fromAddress, `0x${newFromBalance}`],
          id: 2,
        }),
      });

      const setFromResult = await setFromBalanceResponse.json();
      if (setFromResult.error) {
        throw new Error('设置发送方余额失败: ' + setFromResult.error.message);
      }

      // 第3步：修改接收方余额（増加）
      const getToBalanceResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [toAddress, 'latest'],
          id: 3,
        }),
      });

      const toBalanceResult = await getToBalanceResponse.json();
      const toCurrentBalance = BigInt(toBalanceResult.result || '0x0');
      const newToBalance = (toCurrentBalance + amountInWei).toString(16);

      const setToBalanceResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'anvil_setBalance',
          params: [toAddress, `0x${newToBalance}`],
          id: 4,
        }),
      });

      const setToResult = await setToBalanceResponse.json();
      if (setToResult.error) {
        throw new Error('设置接收方余额失败: ' + setToResult.error.message);
      }

      // 生成模拟交易哈希
      const txHash = '0x' + Math.random().toString(16).slice(2).padEnd(64, '0').slice(0, 64);

      return NextResponse.json({
        success: true,
        message: `成功转账 ${amount} BNB 从 ${fromAddress} 到 ${toAddress}`,
        txHash,
      });
    } else {
      // ERC20转账
      throw new Error('ERC20转账当前不支持，请使用原生代币转账');
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
