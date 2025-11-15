import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ok, fail } from '@/lib/serverUtils';
import { formatUnits } from 'ethers';

// Alchemy API配置
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || 'demo';
const ALCHEMY_API_URL = 'https://api.g.alchemy.com/data/v1';

// 正确的Alchemy API响应格式
interface AlchemyTokenItem {
  address: string;
  network: string;
  tokenAddress: string | null;
  tokenBalance: string;
  tokenMetadata: {
    symbol: string | null;
    decimals: number | null;
    name: string | null;
    logo: string | null;
  };
  tokenPrices?: Array<{
    currency: string;
    value: string;
    lastUpdatedAt: string;
  }>;
}

interface AlchemyApiResponse {
  data: {
    tokens: AlchemyTokenItem[];
    pageKey: string | null;
  };
}

interface TokenBalanceInfo {
  tokenAddress: string | null;
  symbol: string;
  name: string;
  decimals: number;
  balanceWei: string;
  balanceEth: string;
  usdValue: number;
  logo?: string;
}

interface WalletBalanceData {
  wallet_address: string;
  chain: string;
  total_usd_value: number;
  token_count: number;
  tokens: TokenBalanceInfo[];
}

/**
 * GET /api/balances/wallet-balance?walletAddress=0x...&chain=bsc
 * 获取钱包地址的所有代币余额和总价值
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const chain = searchParams.get('chain') || 'bsc';
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (!walletAddress) {
      return fail('钱包地址不能为空', 400);
    }

    // 验证钱包地址格式
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return fail('无效的钱包地址格式', 400);
    }

    console.log(`[wallet-balance] 查询钱包 ${walletAddress} 在链 ${chain} 上的余额`);

    // 检查缓存（如果不是强制刷新）
    if (!forceRefresh) {
      const [cacheRows] = await pool.execute(
        `SELECT total_usd_value, token_count, tokens, last_updated 
         FROM wallet_balance_summary 
         WHERE wallet_address = ? AND chain = ? AND last_updated > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
        [walletAddress.toLowerCase(), chain]
      );

      if (cacheRows && (cacheRows as any[]).length > 0) {
        const cacheData = (cacheRows as any[])[0];
        console.log(`[wallet-balance] 使用缓存数据: 总价值 $${cacheData.total_usd_value}, 代币数量: ${cacheData.token_count}`);
        
        return ok({
          wallet_address: walletAddress,
          chain: chain,
          total_usd_value: parseFloat(cacheData.total_usd_value),
          token_count: cacheData.token_count,
          tokens: typeof cacheData.tokens === 'string' ? JSON.parse(cacheData.tokens) : cacheData.tokens,
          cached: true,
          lastUpdated: cacheData.last_updated,
        });
      }
    }

    // 调用Alchemy API获取所有代币余额
    const chainMapping: { [key: string]: string } = {
      'bsc': 'bnb-mainnet',
      'eth': 'eth-mainnet',
      'ethereum': 'eth-mainnet',
      'polygon': 'polygon-mainnet',
      'arbitrum': 'arb-mainnet',
      'optimism': 'opt-mainnet'
    };

    const alchemyChain = chainMapping[chain] || chain;

    // 使用Alchemy的Data API获取所有代币余额
    const alchemyResponse = await fetch(`${ALCHEMY_API_URL}/${ALCHEMY_API_KEY}/assets/tokens/by-address`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addresses: [
          {
            address: walletAddress,
            networks: [alchemyChain]
          }
        ],
        withPrices: true,
        includeErc20Tokens: true
      }),
    });

    if (!alchemyResponse.ok) {
      const errorData = await alchemyResponse.text();
      console.error(`[wallet-balance] Alchemy API错误: ${alchemyResponse.status} - ${errorData}`);
      return fail('获取代币余额失败', 500, { 
        details: `Alchemy API错误: ${alchemyResponse.status}` 
      });
    }

    const alchemyData: AlchemyApiResponse = await alchemyResponse.json();
    console.log(`[wallet-balance] Alchemy API返回数据:`, JSON.stringify(alchemyData, null, 2));

    if (!alchemyData.data || !alchemyData.data.tokens) {
      return fail('未获取到代币余额数据', 404);
    }

    // 处理所有代币余额
    const tokenBalances: TokenBalanceInfo[] = [];
    let totalUsdValue = 0;

    for (const token of alchemyData.data.tokens) {
      try {
        // 跳过余额为0的代币
        const balanceWeiBigInt = BigInt(token.tokenBalance);
        if (balanceWeiBigInt === BigInt(0)) {
          continue;
        }

        // 使用API返回的元数据
        const tokenMetadata = {
          name: token.tokenMetadata.name || 'Unknown Token',
          symbol: token.tokenMetadata.symbol || 'UNKNOWN',
          decimals: token.tokenMetadata.decimals || 18
        };

        // 转换余额（从wei到ether）
        const balanceEth = formatUnits(balanceWeiBigInt.toString(), tokenMetadata.decimals);
        
        // 从API响应中获取USD价格
        const usdPrice = token.tokenPrices?.find(price => price.currency === 'usd');
        const tokenPrice = usdPrice ? parseFloat(usdPrice.value) : 0;
        const usdValue = tokenPrice * parseFloat(balanceEth);

        const tokenInfo: TokenBalanceInfo = {
          tokenAddress: token.tokenAddress,
          symbol: tokenMetadata.symbol,
          name: tokenMetadata.name,
          decimals: tokenMetadata.decimals,
          balanceWei: token.tokenBalance,
          balanceEth: balanceEth,
          usdValue: usdValue,
          logo: token.tokenMetadata.logo || undefined,
        };

        tokenBalances.push(tokenInfo);
        totalUsdValue += usdValue;

        console.log(`[wallet-balance] 代币 ${tokenMetadata.symbol}: ${balanceEth} (${token.tokenAddress}), 价值: $${usdValue.toFixed(2)}`);
      } catch (error) {
        console.warn(`[wallet-balance] 处理代币失败:`, token, error);
      }
    }

    console.log(`[wallet-balance] 找到 ${tokenBalances.length} 个代币, 总价值: $${totalUsdValue.toFixed(2)}`);

    // 准备数据
    const walletBalanceData: WalletBalanceData = {
      wallet_address: walletAddress.toLowerCase(),
      chain: chain,
      total_usd_value: totalUsdValue,
      token_count: tokenBalances.length,
      tokens: tokenBalances,
    };

    // 保存到数据库
    await saveWalletBalanceToDatabase(walletBalanceData);

    return ok({
      wallet_address: walletAddress,
      chain: chain,
      total_usd_value: totalUsdValue,
      token_count: tokenBalances.length,
      tokens: tokenBalances,
      cached: false,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[wallet-balance] 查询余额失败:', error);
    return fail('查询余额失败', 500, { 
      details: error instanceof Error ? error.message : '未知错误' 
    });
  }
}

/**
 * 将钱包余额数据保存到数据库
 */
async function saveWalletBalanceToDatabase(balanceData: WalletBalanceData) {
  try {
    await pool.execute(
      `INSERT INTO wallet_balance_summary 
       (wallet_address, chain, total_usd_value, token_count, tokens)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_usd_value = VALUES(total_usd_value),
         token_count = VALUES(token_count),
         tokens = VALUES(tokens),
         last_updated = CURRENT_TIMESTAMP`,
      [
        balanceData.wallet_address,
        balanceData.chain,
        balanceData.total_usd_value,
        balanceData.token_count,
        JSON.stringify(balanceData.tokens)
      ]
    );
    
    console.log(`[wallet-balance] 钱包余额已保存到数据库`);
  } catch (error) {
    console.error('[wallet-balance] 数据库操作失败:', error);
    throw error;
  }
}