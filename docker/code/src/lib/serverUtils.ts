/**
 * 服务器端工具函数
 * 只能在 API Routes、Server Components 或 Server Actions 中使用
 * ⚠️ 不要在客户端组件中导入此文件！
 */

import pool from './db';
import { NextResponse } from 'next/server';
import { http } from 'viem';

/**
 * 从数据库获取账户的私钥
 * 支持：main_accounts, derived_accounts, imported_accounts
 * @param address - 账户地址
 * @returns 私钥（如果找到）或 null
 */
export async function getPrivateKeyFromDatabase(address: string): Promise<string | null> {
  const connection = await pool.getConnection();
  try {
    const lowerAddress = address.toLowerCase();
    
    // 1. 尝试从主账户表获取
    const [mainRows]: any = await connection.execute(
      'SELECT private_key FROM main_accounts WHERE LOWER(address) = ?',
      [lowerAddress]
    );
    if (mainRows && mainRows.length > 0 && mainRows[0].private_key) {
      console.log('✅ 从 main_accounts 找到私钥');
      return mainRows[0].private_key;
    }
    
    // 2. 尝试从派生账户表获取
    const [derivedRows]: any = await connection.execute(
      'SELECT private_key FROM derived_accounts WHERE LOWER(address) = ?',
      [lowerAddress]
    );
    if (derivedRows && derivedRows.length > 0 && derivedRows[0].private_key) {
      console.log('✅ 从 derived_accounts 找到私钥');
      return derivedRows[0].private_key;
    }
    
    // 3. 尝试从导入账户表获取
    const [importedRows]: any = await connection.execute(
      'SELECT private_key FROM imported_accounts WHERE LOWER(address) = ?',
      [lowerAddress]
    );
    if (importedRows && importedRows.length > 0 && importedRows[0].private_key) {
      console.log('✅ 从 imported_accounts 找到私钥');
      return importedRows[0].private_key;
    }
    
    console.error('❌ 在数据库中找不到该地址的私钥');
    return null;
  } finally {
    connection.release();
  }
}

/**
 * 解读常见的区块链错误信息，返回用户友好的提示
 * @param error - 原始错误对象或错误信息
 * @returns 友好的错误提示
 */
export function parseBlockchainError(error: any): string {
  const errorMessage = typeof error === 'string' ? error : (error?.message || String(error));
  const lowerMsg = errorMessage.toLowerCase();

  // 余额不足
  if (lowerMsg.includes('insufficient funds') || 
      lowerMsg.includes('insufficient balance') ||
      lowerMsg.includes('exceeds balance')) {
    return '❌ 账户余额不足，无法完成交易。请检查账户余额是否充足。';
  }

  // Gas 不足
  if (lowerMsg.includes('out of gas') || 
      lowerMsg.includes('gas required exceeds') ||
      lowerMsg.includes('intrinsic gas too low')) {
    return '❌ Gas 不足。请增加 Gas Limit 或确保账户有足够的 ETH/BNB 支付 Gas 费用。';
  }

  // Nonce 问题
  if (lowerMsg.includes('nonce too low') || lowerMsg.includes('nonce too high')) {
    return '❌ 交易 Nonce 错误。可能是有待处理的交易，请稍后重试。';
  }

  // 交易被 revert
  if (lowerMsg.includes('revert') || lowerMsg.includes('reverted')) {
    // 尝试提取 revert 原因
    const revertMatch = errorMessage.match(/revert(?:ed)?\s+(.+?)(?:\n|$|,)/i);
    const revertReason = revertMatch ? revertMatch[1].trim() : '';
    
    if (revertReason) {
      return `❌ 交易被拒绝: ${revertReason}`;
    }
    // 视图函数常见：no data present / require(false)
    if (lowerMsg.includes('no data present') || lowerMsg.includes('require(false)')) {
      return '❌ 视图函数执行失败：参数无效或索引越界。请检查输入是否在合法范围内。';
    }
    return '❌ 交易被智能合约拒绝。可能原因：\n• 代币余额不足\n• 未授权转账\n• 合约条件不满足';
  }

  // RPC 连接问题
  if (lowerMsg.includes('fetch failed') || 
      lowerMsg.includes('network') ||
      lowerMsg.includes('econnrefused') ||
      lowerMsg.includes('timeout')) {
    return '❌ 无法连接到区块链节点。请检查：\n• Anvil Fork 网络是否正在运行\n• RPC URL 是否正确\n• 网络连接是否正常';
  }

  // 节点错误
  if (lowerMsg.includes('empty reader set') || 
      lowerMsg.includes('method handler crashed')) {
    return '❌ RPC 节点出现内部错误。建议：\n• 重启 Anvil Fork 网络\n• 更换 RPC 提供商\n• 使用更稳定的区块高度';
  }

  // 无效地址
  if (lowerMsg.includes('invalid address') || lowerMsg.includes('invalid recipient')) {
    return '❌ 无效的地址格式。请检查接收方地址是否正确。';
  }

  // 私钥/签名问题
  if (lowerMsg.includes('no signer') || 
      lowerMsg.includes('private key') ||
      lowerMsg.includes('signature')) {
    return '❌ 签名失败。该账户的私钥不存在或无效，请确保账户已正确导入。';
  }

  // 合约不存在
  if (lowerMsg.includes('contract') && 
      (lowerMsg.includes('not found') || lowerMsg.includes('does not exist'))) {
    return '❌ 智能合约不存在。请检查合约地址是否正确。';
  }

  // 超时或长时间等待
  if (lowerMsg.includes('timeout') || lowerMsg.includes('timed out')) {
    return '❌ 交易处理时间过长。可能原因：\n• Anvil Fork 网络未正常运行\n• RPC 节点响应缓慢\n• 网络连接问题\n\n建议：检查 Anvil 进程是否正常运行';
  }

  // ERC20 代币错误
  if (lowerMsg.includes('erc20') || lowerMsg.includes('transfer amount exceeds')) {
    return '❌ ERC20 代币转账失败。可能原因：\n• 代币余额不足\n• 未授权该合约\n• 代币合约存在限制';
  }

  // 如果没有匹配到已知错误，返回原始错误信息
  return `❌ 交易失败: ${errorMessage}`;
}

export function getRpcUrl(network: string): string {
  const rpcUrls: Record<string, string> = {
    fork: process.env.ANVIL_RPC_URL || 'http://anvil-api:8545',
    ethereum: process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : 'https://mainnet.infura.io/v3/YOUR_KEY',
    bsc: 'https://bsc-dataseed1.bnbchain.org',
    polygon: 'https://polygon-rpc.com',
    arbitrum: process.env.ALCHEMY_API_KEY ? `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : 'https://arb1.arbitrum.io/rpc',
    optimism: process.env.ALCHEMY_API_KEY ? `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : 'https://mainnet.optimism.io',
  };
  const key = (network || 'fork').toLowerCase();
  return rpcUrls[key] || rpcUrls.fork;
}

export function getRpcUrlOr(network: string, fallback: string): string {
  try {
    const url = getRpcUrl(network);
    return url || fallback;
  } catch {
    return fallback;
  }
}

export function createHttpTransport(rpcUrl: string, opts?: { timeout?: number; retryCount?: number; retryDelay?: number }) {
  const { timeout = 0, retryCount = 3, retryDelay = 1000 } = opts || {};
  return http(rpcUrl, { timeout, retryCount, retryDelay });
}

export function ok(data: any, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(error: any, status = 400, extra?: Record<string, any>, init?: ResponseInit) {
  const message = typeof error === 'string' ? error : error?.message || String(error);
  return NextResponse.json({ success: false, error: message, ...(extra || {}) }, { status, ...(init || {}) });
}

export async function serverFetch(url: string, init?: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...(init || {}), signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function rpcCall<T = any>(rpcUrl: string, method: string, params: any[] = [], timeoutMs = 10000): Promise<T> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params });
  const res = await serverFetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }, timeoutMs);
  const json = await res.json();
  if (json?.error) throw new Error(json.error.message || 'JSON-RPC Error');
  return json?.result as T;
}
