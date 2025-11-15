import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { ok, fail } from '@/lib/serverUtils';
import { formatUnits } from 'ethers';

/**
 * 从notes中提取代币符号
 */
function extractSymbolFromNotes(notes: string): string | null {
  if (!notes) return null;
  
  // 尝试从notes中提取代币符号，例如 "CAKE token for testing" -> "CAKE"
  const symbolMatch = notes.match(/\b([A-Z]{2,10})\b/);
  return symbolMatch ? symbolMatch[1] : null;
}

/**
 * 从地址中推断可能的代币符号（基于已知地址）
 */
function extractSymbolFromAddress(address: string): string | null {
  const knownTokens: { [key: string]: string } = {
    '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82': 'CAKE', // BSC CAKE
    '0x55d398326f99059ff775485246999027b3197955': 'USDT', // BSC USDT
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'USDC', // BSC USDC
    '0x2170ed0880ac9a755fd29b2688956bd959f933f8': 'ETH',  // BSC ETH
    '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c': 'BTC',  // BSC BTCB
    '0x6ca9e317b92c85a20f78a80442dcb76fb7077777': 'BNB',  // 用户数据库中的地址，可能是BNB
  };
  
  return knownTokens[address.toLowerCase()] || null;
}

/**
 * 判断是否为链的原生代币地址
 */
function isNativeToken(tokenAddress: string): boolean {
  // 原生代币地址通常有以下几种情况：
  // 1. 0x0000000000000000000000000000000000000000
  // 2. 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
  // 3. 空地址或特殊标记
  const nativeTokenAddresses = [
    '0x0000000000000000000000000000000000000000',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '',
  ];
  
  const lowerAddress = tokenAddress.toLowerCase();
  return nativeTokenAddresses.includes(lowerAddress) || 
         lowerAddress === '0x6ca9e317b92c85a20f78a80442dcb76fb7077777'; // 用户数据库中的地址看起来像原生代币
}

// Alchemy API配置
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || 'demo';
const ALCHEMY_API_URL = 'https://api.g.alchemy.com/data/v1';

// 正确的Alchemy API响应格式
interface AlchemyTokenItem {
  address: string;
  network: string;
  tokenAddress: string;
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
 * GET /api/balances/token-balance/:tokenId
 * 获取指定代币的余额信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  try {
    const { tokenId: tokenIdParam } = await params;
    const tokenId = parseInt(tokenIdParam);
    
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (isNaN(tokenId)) {
      return fail('无效的代币ID', 400);
    }

    // 获取代币信息
    const [tokenRows] = await pool.execute(
      'SELECT id, chain, address FROM imported_tokens WHERE id = ?',
      [tokenId]
    );

    if (!tokenRows || tokenRows.length === 0) {
      return fail('未找到指定的代币', 404);
    }

    const token = tokenRows[0];
    const tokenAddress = token.address.toLowerCase();
    
    console.log(`[token-balance] 查询代币 ${tokenAddress} 在链 ${token.chain} 上的余额`);

    // 如果没有提供钱包地址，返回错误
    if (!walletAddress) {
      return fail('钱包地址不能为空', 400);
    }

    // 验证钱包地址格式
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return fail('无效的钱包地址格式', 400);
    }

    // 检查缓存（如果不是强制刷新）
    if (!forceRefresh) {
      const [cacheRows] = await pool.execute(
        `SELECT balance_wei, balance_eth, usd_value, updated_at 
         FROM token_balances 
         WHERE wallet_address = ? AND token_address = ? AND chain = ? AND updated_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
        [walletAddress.toLowerCase(), tokenAddress, token.chain]
      );

      if (cacheRows && cacheRows.length > 0) {
        const cacheData = cacheRows[0];
        console.log(`[token-balance] 使用缓存数据: ${cacheData.balance_eth} ETH, 价值: $${cacheData.usd_value}`);
        
        return ok({
          token: {
            id: token.id,
            chain: token.chain,
            address: token.address,
          },
          balance: {
            balance_wei: cacheData.balance_wei,
            balance_eth: cacheData.balance_eth,
            usd_value: parseFloat(cacheData.usd_value),
          },
          cached: true,
          lastUpdated: cacheData.updated_at,
        });
      }
    }

    // 调用Alchemy API获取代币余额 - 使用正确的Data API
    const chainMapping: { [key: string]: string } = {
      'bsc': 'bnb-mainnet',
      'eth': 'eth-mainnet',
      'ethereum': 'eth-mainnet',
      'polygon': 'polygon-mainnet',
      'arbitrum': 'arb-mainnet',
      'optimism': 'opt-mainnet'
    };

    const alchemyChain = chainMapping[token.chain] || token.chain;

    // 使用Alchemy的Data API获取代币余额
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
      console.error(`[token-balance] Alchemy API错误: ${alchemyResponse.status} - ${errorData}`);
      return fail('获取代币余额失败', 500, { 
        details: `Alchemy API错误: ${alchemyResponse.status}` 
      });
    }

    const alchemyData: AlchemyApiResponse = await alchemyResponse.json();
    console.log(`[token-balance] Alchemy API返回数据:`, JSON.stringify(alchemyData, null, 2));
    console.log(`[token-balance] 查询参数: wallet=${walletAddress}, token=${tokenAddress}, chain=${alchemyChain}`);

    if (!alchemyData.data || !alchemyData.data.tokens) {
      return fail('未获取到代币余额数据', 404);
    }

    // 查找指定代币的余额
    console.log(`[token-balance] 所有代币余额:`, alchemyData.data.tokens.map((tb: AlchemyTokenItem) => ({
      tokenAddress: tb.tokenAddress,
      tokenBalance: tb.tokenBalance,
      symbol: tb.tokenMetadata.symbol,
      name: tb.tokenMetadata.name
    })));
    console.log(`[token-balance] 查找目标代币: ${tokenAddress}`);
    
    // 特殊处理：如果数据库中的地址与钱包地址相同，优先返回原生代币余额
    let targetToken: AlchemyTokenItem | undefined;
    if (walletAddress.toLowerCase() === tokenAddress.toLowerCase()) {
      targetToken = alchemyData.data.tokens.find(tb => !tb.tokenAddress);
      if (targetToken) {
        console.log(`[token-balance] 使用原生代币余额（地址匹配）`);
      }
    }

    // 如果还没找到，尝试精确匹配 - 注意tokenAddress可能为null（原生代币如BNB）
    if (!targetToken) {
      targetToken = alchemyData.data.tokens.find(
        (tb: AlchemyTokenItem) => {
          if (!tb.tokenAddress) {
            // 对于原生代币（tokenAddress为null），检查是否是链的原生代币
            return isNativeToken(tokenAddress);
          }
          return tb.tokenAddress.toLowerCase() === tokenAddress;
        }
      );
    }

    // 如果没有找到，尝试通过符号匹配（作为备选方案）
    if (!targetToken) {
      console.log(`[token-balance] 未找到精确匹配的代币，尝试通过符号匹配...`);
      
      // 获取数据库中的代币符号（如果可用）
      const [tokenInfoRows] = await pool.execute(
        'SELECT notes FROM imported_tokens WHERE id = ?',
        [tokenId]
      );
      
      const tokenNotes = tokenInfoRows?.[0]?.notes || '';
      const possibleSymbol = extractSymbolFromNotes(tokenNotes) || extractSymbolFromAddress(tokenAddress);
      
      if (possibleSymbol) {
        targetToken = alchemyData.data.tokens.find(
          (tb: AlchemyTokenItem) => tb.tokenMetadata.symbol && 
          tb.tokenMetadata.symbol.toLowerCase() === possibleSymbol.toLowerCase()
        );
        
        if (targetToken) {
          console.log(`[token-balance] 通过符号 ${possibleSymbol} 找到匹配代币: ${targetToken.tokenAddress}`);
        }
      }
    }

    if (!targetToken) {
      console.log(`[token-balance] 未找到代币 ${tokenAddress} 的余额数据`);
      return ok({
        token: {
          id: token.id,
          chain: token.chain,
          address: token.address,
        },
        balance: {
          balance_wei: '0',
          balance_eth: '0',
          usd_value: 0,
        },
        cached: false,
        lastUpdated: new Date().toISOString(),
      });
    }

    // 检查余额是否为0
    const balanceWeiHex = targetToken.tokenBalance;
    const balanceWeiBigInt = BigInt(balanceWeiHex);
    
    if (balanceWeiBigInt === BigInt(0)) {
      console.log(`[token-balance] 代币 ${tokenAddress} 余额为0`);
      // 即使余额为0，我们也继续处理，因为可能有USD价格信息
    }

    // 使用API返回的元数据
    const tokenMetadata = {
      name: targetToken.tokenMetadata.name || 'Unknown Token',
      symbol: targetToken.tokenMetadata.symbol || 'UNKNOWN',
      decimals: targetToken.tokenMetadata.decimals || 18
    };

    // 转换余额（从wei到ether）
    const balanceEth = formatUnits(balanceWeiBigInt.toString(), tokenMetadata.decimals);
    
    // 从API响应中获取USD价格
    const usdPrice = targetToken.tokenPrices?.find(price => price.currency === 'usd');
    const tokenPrice = usdPrice ? parseFloat(usdPrice.value) : 0;
    const usdValue = tokenPrice * parseFloat(balanceEth);

    const balanceData = {
      wallet_address: walletAddress.toLowerCase(),
      token_address: tokenAddress,
      token_symbol: tokenMetadata.symbol,
      token_name: tokenMetadata.name,
      chain: token.chain,
      balance_wei: balanceWeiHex,
      balance_eth: balanceEth,
      usd_value: usdValue,
      decimals: tokenMetadata.decimals,
      logo_url: targetToken.tokenMetadata.logo,
    };

    // 存储到数据库
    await saveTokenBalanceToDatabase(balanceData);

    console.log(`[token-balance] 查询完成: ${balanceEth} ETH, 价值: $${usdValue.toFixed(2)}`);

    return ok({
      token: {
        id: token.id,
        chain: token.chain,
        address: token.address,
      },
      balance: {
        balance_wei: balanceWeiHex,
        balance_eth: balanceEth,
        usd_value: usdValue,
      },
      cached: false,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[token-balance] 查询余额失败:', error);
    return fail('查询余额失败', 500, { 
      details: error instanceof Error ? error.message : '未知错误' 
    });
  }
}

/**
 * 将代币余额数据保存到数据库
 */
async function saveTokenBalanceToDatabase(balanceData: TokenBalanceData) {
  try {
    await pool.execute(
      `INSERT INTO token_balances 
       (wallet_address, token_address, token_symbol, token_name, chain, 
        balance_wei, balance_eth, usd_value, decimals, logo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         balance_wei = VALUES(balance_wei),
         balance_eth = VALUES(balance_eth),
         usd_value = VALUES(usd_value),
         token_symbol = VALUES(token_symbol),
         token_name = VALUES(token_name),
         decimals = VALUES(decimals),
         logo_url = VALUES(logo_url),
         updated_at = CURRENT_TIMESTAMP`,
      [
        balanceData.wallet_address,
        balanceData.token_address,
        balanceData.token_symbol,
        balanceData.token_name,
        balanceData.chain,
        balanceData.balance_wei,
        balanceData.balance_eth,
        balanceData.usd_value,
        balanceData.decimals,
        balanceData.logo_url || null
      ]
    );
    
    console.log(`[token-balance] 代币余额已保存到数据库`);
  } catch (error) {
    console.error('[token-balance] 数据库操作失败:', error);
    throw error;
  }
}