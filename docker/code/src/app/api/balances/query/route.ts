import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ok, fail } from '@/lib/serverUtils';

// Alchemy API配置
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || 'demo';
const ALCHEMY_API_URL = 'https://api.g.alchemy.com/data/v1';

interface TokenBalance {
  contractAddress: string;
  tokenBalance: string;
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

interface AlchemyTokenResponse {
  address: string;
  tokenBalances: TokenBalance[];
}

interface TokenBalanceData {
  wallet_address: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  chain: string;
  balance_wei: string;
  balance_eth: string;
  usd_value: number;
  decimals: number;
  logo_url?: string;
}

/**
 * POST /api/balances/query
 * 查询钱包代币余额
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, chain = 'bnb-mainnet', forceRefresh = false } = body;

    if (!walletAddress) {
      return fail('钱包地址不能为空', 400);
    }

    // 验证钱包地址格式
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return fail('无效的钱包地址格式', 400);
    }

    console.log(`[balances] 查询钱包 ${walletAddress} 在 ${chain} 链上的余额`);

    // 检查缓存（如果不是强制刷新）
    if (!forceRefresh) {
      const [cacheRows]: any = await pool.execute(
        `SELECT wallet_address, total_usd_value, token_count, last_updated 
         FROM wallet_balance_summary 
         WHERE wallet_address = ? AND last_updated > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
        [walletAddress.toLowerCase()]
      );

      if (cacheRows && cacheRows.length > 0) {
        const cacheData = cacheRows[0];
        console.log(`[balances] 使用缓存数据: 总价值 $${cacheData.total_usd_value}, 更新时间: ${cacheData.last_updated}`);
        
        // 获取详细的代币余额
        const [balanceRows]: any = await pool.execute(
          `SELECT token_symbol, token_name, balance_wei, balance_eth, usd_value, decimals, logo_url
           FROM token_balances 
           WHERE wallet_address = ? 
           ORDER BY usd_value DESC`,
          [walletAddress.toLowerCase()]
        );

        return ok({
          walletAddress: cacheData.wallet_address,
          totalUsdValue: parseFloat(cacheData.total_usd_value),
          tokenCount: cacheData.token_count,
          balances: balanceRows,
          cached: true,
          lastUpdated: cacheData.last_updated,
        });
      }
    }

    // 调用Alchemy API获取代币余额
    const alchemyResponse = await fetch(`${ALCHEMY_API_URL}/${ALCHEMY_API_KEY}/assets/tokens/by-address`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addresses: [
          {
            address: walletAddress,
            networks: [chain]
          }
        ]
      }),
    });

    if (!alchemyResponse.ok) {
      const errorData = await alchemyResponse.text();
      console.error(`[balances] Alchemy API错误: ${alchemyResponse.status} - ${errorData}`);
      return fail('获取代币余额失败', 500, { 
        details: `Alchemy API错误: ${alchemyResponse.status}` 
      });
    }

    const alchemyData = await alchemyResponse.json();
    console.log(`[balances] Alchemy API返回数据:`, JSON.stringify(alchemyData, null, 2));

    if (!alchemyData.data || !alchemyData.data[0]) {
      return fail('未获取到代币余额数据', 404);
    }

    const tokenData: AlchemyTokenResponse = alchemyData.data[0];
    const balances: TokenBalanceData[] = [];
    let totalUsdValue = 0;

    // 处理每个代币的余额
    for (const tokenBalance of tokenData.tokenBalances) {
      try {
        // 跳过余额为0的代币
        if (tokenBalance.tokenBalance === '0') {
          continue;
        }

        // 转换余额（从wei到ether）
        const balanceWei = tokenBalance.tokenBalance;
        const balanceEth = (BigInt(balanceWei) / BigInt(10 ** tokenBalance.decimals)).toString();
        
        // 计算USD价值（这里简化处理，实际需要获取价格）
        // 由于Alchemy API没有直接提供价格，我们需要通过其他方式获取
        const usdValue = await getTokenUsdValue(
          tokenBalance.contractAddress,
          tokenBalance.symbol,
          balanceEth,
          tokenBalance.decimals,
          chain
        );

        const balanceData: TokenBalanceData = {
          wallet_address: walletAddress.toLowerCase(),
          token_address: tokenBalance.contractAddress.toLowerCase(),
          token_symbol: tokenBalance.symbol,
          token_name: tokenBalance.name,
          chain: chain,
          balance_wei: balanceWei,
          balance_eth: balanceEth,
          usd_value: usdValue,
          decimals: tokenBalance.decimals,
          logo_url: tokenBalance.logo,
        };

        balances.push(balanceData);
        totalUsdValue += usdValue;

      } catch (error) {
        console.error(`[balances] 处理代币 ${tokenBalance.symbol} 失败:`, error);
        continue;
      }
    }

    // 存储到数据库
    await saveBalancesToDatabase(balances, walletAddress.toLowerCase(), totalUsdValue);

    console.log(`[balances] 查询完成: ${balances.length} 个代币, 总价值: $${totalUsdValue.toFixed(2)}`);

    return ok({
      walletAddress: walletAddress.toLowerCase(),
      totalUsdValue,
      tokenCount: balances.length,
      balances: balances.sort((a, b) => b.usd_value - a.usd_value),
      cached: false,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[balances] 查询余额失败:', error);
    return fail('查询余额失败', 500, { 
      details: error instanceof Error ? error.message : '未知错误' 
    });
  }
}

/**
 * 获取代币的USD价值
 */
async function getTokenUsdValue(
  contractAddress: string,
  symbol: string,
  balanceEth: string,
  decimals: number,
  chain: string
): Promise<number> {
  try {
    // 这里简化处理，实际应该调用价格API获取实时价格
    // 对于主要代币，我们可以使用一些默认价格或者调用价格API
    
    const majorTokens: { [key: string]: number } = {
      'USDT': 1.0,
      'USDC': 1.0,
      'BUSD': 1.0,
      'DAI': 1.0,
      'WBNB': 300.0, // 示例价格
      'BNB': 300.0,
      'ETH': 2000.0,
      'WETH': 2000.0,
      'BTC': 30000.0,
      'WBTC': 30000.0,
    };

    const price = majorTokens[symbol.toUpperCase()] || 0;
    const balance = parseFloat(balanceEth);
    
    return price * balance;
  } catch (error) {
    console.warn(`[balances] 获取代币 ${symbol} 价格失败:`, error);
    return 0;
  }
}

/**
 * 将余额数据保存到数据库
 */
async function saveBalancesToDatabase(
  balances: TokenBalanceData[],
  walletAddress: string,
  totalUsdValue: number
) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // 删除旧的余额数据
    await connection.execute(
      'DELETE FROM token_balances WHERE wallet_address = ?',
      [walletAddress]
    );

    // 插入新的余额数据
    for (const balance of balances) {
      await connection.execute(
        `INSERT INTO token_balances 
         (wallet_address, token_address, token_symbol, token_name, chain, 
          balance_wei, balance_eth, usd_value, decimals, logo_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          balance.wallet_address,
          balance.token_address,
          balance.token_symbol,
          balance.token_name,
          balance.chain,
          balance.balance_wei,
          balance.balance_eth,
          balance.usd_value,
          balance.decimals,
          balance.logo_url || null
        ]
      );
    }

    // 更新余额汇总
    await connection.execute(
      `INSERT INTO wallet_balance_summary 
       (wallet_address, total_usd_value, token_count)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_usd_value = VALUES(total_usd_value),
         token_count = VALUES(token_count),
         last_updated = CURRENT_TIMESTAMP`,
      [walletAddress, totalUsdValue, balances.length]
    );

    await connection.commit();
    console.log(`[balances] 数据库更新完成: ${balances.length} 个代币余额已保存`);

  } catch (error) {
    await connection.rollback();
    console.error('[balances] 数据库操作失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * GET /api/balances/query
 * 获取钱包余额汇总信息
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return fail('钱包地址不能为空', 400);
    }

    // 获取余额汇总
    const [summaryRows]: any = await pool.execute(
      `SELECT wallet_address, total_usd_value, token_count, last_updated
       FROM wallet_balance_summary 
       WHERE wallet_address = ?`,
      [walletAddress.toLowerCase()]
    );

    if (!summaryRows || summaryRows.length === 0) {
      return fail('未找到该钱包的余额信息', 404);
    }

    const summary = summaryRows[0];

    // 获取详细的代币余额
    const [balanceRows]: any = await pool.execute(
      `SELECT token_symbol, token_name, balance_wei, balance_eth, usd_value, decimals, logo_url
       FROM token_balances 
       WHERE wallet_address = ? 
       ORDER BY usd_value DESC`,
      [walletAddress.toLowerCase()]
    );

    return ok({
      walletAddress: summary.wallet_address,
      totalUsdValue: parseFloat(summary.total_usd_value),
      tokenCount: summary.token_count,
      balances: balanceRows,
      lastUpdated: summary.last_updated,
    });

  } catch (error) {
    console.error('[balances] 获取余额信息失败:', error);
    return fail('获取余额信息失败', 500, { 
      details: error instanceof Error ? error.message : '未知错误' 
    });
  }
}