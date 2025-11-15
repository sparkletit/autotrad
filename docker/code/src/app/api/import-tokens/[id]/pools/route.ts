import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, getAddress, formatUnits } from 'viem';
import { bsc, mainnet, polygon, arbitrum, optimism } from 'viem/chains';
import pool from '@/lib/db';
import { getRpcUrl, ok, fail } from '@/lib/serverUtils';
import { Hex } from 'viem';

// External API configuration
const AVEDATA_API_URL = 'https://openapi.avedata.org/api/v1';
const AVEDATA_API_KEY = process.env.AVEDATA_API_KEY || '';

// DEX Factory addresses across different chains
const DEX_FACTORIES = {
  bsc: {
    name: 'PancakeSwap V2',
    address: '0xca143ce32fe78f1f7019d7d551a6402fc5350c73',
    chain: bsc,
  },
  ethereum: {
    name: 'Uniswap V2',
    address: '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f',
    chain: mainnet,
  },
  polygon: {
    name: 'QuickSwap',
    address: '0x5757371414417b8c6caad45baef941abc7d3ab32',
    chain: polygon,
  },
  arbitrum: {
    name: 'SushiSwap',
    address: '0xc35dadb65012ec5796536bd9864ed8773abc74c4',
    chain: arbitrum,
  },
  optimism: {
    name: 'Velodrome',
    address: '0x25cbddb98b35ab1ff77413456b31ec81a6ad6eeb',
    chain: optimism,
  },
};

// Stablecoin addresses for price calculation
const STABLECOINS = {
  bsc: '0x55d398326f99059ff775485246999027b3197955', // USDT
  ethereum: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  polygon: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', // USDT
  arbitrum: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT
  optimism: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', // USDT
};

// WETH/WBNB addresses for additional pair analysis
const WRAPPED_NATIVE_TOKENS = {
  bsc: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  polygon: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
  arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
  optimism: '0x4200000000000000000000000000000000000006', // WETH
};

// Factory ABI
const FACTORY_ABI = [
  {
    constant: true,
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    name: 'getPair',
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Pair ABI
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
    outputs: [{ name: '', type: 'address' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'token1',
    outputs: [{ name: '', type: 'address' }],
    type: 'function',
  },
] as const;

// ERC20 ABI for decimals
const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
] as const;

interface TokenInfo {
  id: number;
  chain: string;
  address: string;
}

interface PoolInfo {
  dex: string;
  chain: string;
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  usdtPrice: number;
  blockTimestamp: number;
}

interface CacheData {
  pools: PoolInfo[];
  summary: {
    totalPools: number;
    chains: string[];
    dexes: string[];
    averagePrice: number;
  };
}

/**
 * GET /api/import-tokens/[id]/pools
 * 获取指定代币的交易池信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    
    // 获取刷新参数
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';
    
    if (isNaN(id)) {
      return fail('无效的代币ID', 400);
    }

    // 获取代币信息
    const [rows]: any = await pool.execute(
      'SELECT id, chain, address FROM imported_tokens WHERE id = ?',
      [id]
    );

    if (!rows || rows.length === 0) {
      return fail('未找到指定的代币', 404);
    }

    const token: TokenInfo = rows[0];
    const tokenAddress = token.address.toLowerCase();
    
    console.log(`[pools] 分析代币 ${tokenAddress} 在链 ${token.chain} 上的交易池 (刷新: ${refresh})`);

    // 检查缓存（如果不是强制刷新）
    if (!refresh) {
      const [cacheRows]: any = await pool.execute(
        `SELECT pools_data, pool_count, expires_at 
         FROM token_pools_cache 
         WHERE token_id = ? AND chain = ? AND expires_at > NOW()
         ORDER BY updated_at DESC 
         LIMIT 1`,
        [id, token.chain]
      );

      if (cacheRows && cacheRows.length > 0) {
        const cacheRow = cacheRows[0];
        try {
          // MySQL JSON字段返回的是对象，不是字符串
          const cacheData: CacheData = typeof cacheRow.pools_data === 'string' 
            ? JSON.parse(cacheRow.pools_data) 
            : cacheRow.pools_data;
          
          console.log(`[pools] 使用缓存数据: ${cacheRow.pool_count} 个交易池, 过期时间: ${cacheRow.expires_at}`);
          
          return ok({
            token: {
              id: token.id,
              chain: token.chain,
              address: token.address,
            },
            summary: cacheData.summary,
            pools: cacheData.pools,
            cached: true,
            expires_at: cacheRow.expires_at,
          });
        } catch (parseError) {
          console.error('[pools] 缓存数据解析失败:', parseError);
          // 如果缓存数据解析失败，继续执行新的分析
          console.log('[pools] 缓存数据无效，进行新的分析');
        }
      }
    } else {
      console.log('[pools] 强制刷新，跳过缓存检查');
    }

    // 如果没有缓存或缓存已过期，进行新的分析
    console.log(`[pools] 缓存未命中，进行新的分析`);

    const pools: PoolInfo[] = [];
    
    // 只分析代币所在链的交易池
    const tokenChain = token.chain.toLowerCase();
    const dexInfo = DEX_FACTORIES[tokenChain as keyof typeof DEX_FACTORIES];
    
    if (dexInfo) {
      console.log(`[pools] 分析代币所在链 ${tokenChain} 的交易池`);
      try {
        const chainPools = await analyzePoolsForChain(tokenAddress, tokenChain, dexInfo);
        pools.push(...chainPools);
      } catch (error) {
        console.error(`[pools] 分析 ${tokenChain} 链失败:`, error);
      }
    } else {
      console.warn(`[pools] 未找到 ${tokenChain} 链的 DEX 配置`);
    }

    // 汇总统计
    const summary = {
      totalPools: pools.length,
      chains: [...new Set(pools.map(p => p.chain))],
      dexes: [...new Set(pools.map(p => p.dex))],
      averagePrice: pools.length > 0 ? pools.reduce((sum, p) => sum + p.usdtPrice, 0) / pools.length : 0,
    };

    // 缓存结果（1小时有效期）
    const cacheData: CacheData = {
      pools: pools.sort((a, b) => b.usdtPrice - a.usdtPrice),
      summary,
    };

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期
    
    const cacheDataJson = JSON.stringify(cacheData);
    console.log(`[pools] 缓存数据长度: ${cacheDataJson.length} 字符`);
    console.log(`[pools] 缓存数据预览: ${cacheDataJson.substring(0, 200)}...`);
    
    try {
      if (refresh) {
        // 如果是强制刷新，先删除旧缓存
        await pool.execute(
          `DELETE FROM token_pools_cache WHERE token_id = ? AND chain = ?`,
          [id, token.chain]
        );
        console.log('[pools] 已删除旧缓存');
      }
      
      await pool.execute(
        `INSERT INTO token_pools_cache (token_id, chain, token_address, pools_data, pool_count, expires_at) 
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           pools_data = VALUES(pools_data),
           pool_count = VALUES(pool_count),
           expires_at = VALUES(expires_at),
           updated_at = CURRENT_TIMESTAMP`,
        [id, token.chain, tokenAddress, cacheDataJson, pools.length, expiresAt]
      );
      console.log('[pools] 缓存存储成功');
    } catch (dbError) {
      console.error('[pools] 缓存存储失败:', dbError);
      throw dbError;
    }

    console.log(`[pools] 分析完成并缓存: 找到 ${pools.length} 个交易池，缓存过期时间: ${expiresAt.toISOString()}`);

    return ok({
      token: {
        id: token.id,
        chain: token.chain,
        address: token.address,
      },
      summary,
      pools: cacheData.pools,
      cached: false,
      expires_at: expiresAt.toISOString(),
    });

  } catch (error) {
    console.error('[pools] 分析交易池失败:', error);
    return fail('分析交易池失败', 500, { 
      details: error instanceof Error ? error.message : '未知错误' 
    });
  }
}

/**
 * 分析特定链上的交易池
 */
async function analyzePoolsForChain(
  tokenAddress: string,
  chainKey: string,
  dexInfo: any
): Promise<PoolInfo[]> {
  const pools: PoolInfo[] = [];
  
  try {
    const rpcUrl = getRpcUrl(chainKey);
    console.log(`[pools] 使用 RPC URL: ${rpcUrl} 对于链 ${chainKey}`);
    
    const publicClient = createPublicClient({
      chain: dexInfo.chain,
      transport: http(rpcUrl, { 
        batch: false,
        timeout: 10000, // 10秒超时
        retryCount: 2,
        retryDelay: 1000,
      }),
    });

    const stablecoinAddress = STABLECOINS[chainKey as keyof typeof STABLECOINS];
    const wrappedNativeAddress = WRAPPED_NATIVE_TOKENS[chainKey as keyof typeof WRAPPED_NATIVE_TOKENS];
    
    if (!stablecoinAddress && !wrappedNativeAddress) {
      console.warn(`[pools] ${chainKey} 链没有配置稳定币或原生代币地址`);
      return pools;
    }

    // 获取与稳定币的交易对
    const factoryAddr = getAddress(dexInfo.address);
    const tokenAddr = getAddress(tokenAddress);
    
    // 先检查稳定币交易对
    let pairAddress: string | null = null;
    let pairTokenAddress: string | null = null;
    let pairType: 'stablecoin' | 'wrapped' | null = null;
    
    if (stablecoinAddress) {
      const stableAddr = getAddress(stablecoinAddress);
      console.log(`[pools] 查询 ${chainKey} 链 ${dexInfo.name}: ${tokenAddr} ↔ ${stableAddr} (稳定币)`);

      try {
        const pairPromise = publicClient.readContract({
          address: factoryAddr as Hex,
          abi: FACTORY_ABI,
          functionName: 'getPair',
          args: [tokenAddr as Hex, stableAddr as Hex],
        }) as Promise<string>;
        
        // 5秒超时
        pairAddress = await Promise.race([
          pairPromise,
          new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error('Factory 查询超时')), 5000)
          )
        ]);
        
        const zeroAddress = '0x0000000000000000000000000000000000000000';
        if (pairAddress && pairAddress.toLowerCase() !== zeroAddress) {
          pairTokenAddress = stableAddr;
          pairType = 'stablecoin';
          console.log(`[pools] 找到稳定币交易对: ${pairAddress}`);
        } else {
          console.log(`[pools] 未找到稳定币交易对，地址: ${pairAddress}`);
        }
      } catch (error) {
        console.warn(`[pools] ${chainKey} 链稳定币交易对查询失败:`, error);
      }
    }
    
    // 如果没有稳定币交易对，检查原生代币交易对
    if (!pairAddress || pairAddress.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      const wrappedAddr = getAddress(wrappedNativeAddress);
      console.log(`[pools] 查询 ${chainKey} 链 ${dexInfo.name}: ${tokenAddr} ↔ ${wrappedAddr} (原生代币)`);

      try {
        const pairPromise = publicClient.readContract({
          address: factoryAddr as Hex,
          abi: FACTORY_ABI,
          functionName: 'getPair',
          args: [tokenAddr as Hex, wrappedAddr as Hex],
        }) as Promise<string>;
        
        // 5秒超时
        pairAddress = await Promise.race([
          pairPromise,
          new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error('Factory 查询超时')), 5000)
          )
        ]);
        
        const zeroAddress = '0x0000000000000000000000000000000000000000';
        if (pairAddress && pairAddress.toLowerCase() !== zeroAddress) {
          pairTokenAddress = wrappedAddr;
          pairType = 'wrapped';
          console.log(`[pools] 找到原生代币交易对: ${pairAddress}`);
        } else {
          console.log(`[pools] 未找到原生代币交易对，地址: ${pairAddress}`);
        }
      } catch (error) {
        console.error(`[pools] ${chainKey} 链原生代币交易对查询失败:`, error);
        return pools;
      }
    }
    
    if (!pairAddress) {
      console.log(`[pools] ${chainKey} 链未找到交易对`);
      return pools;
    }
    
    console.log(`[pools] 找到交易对地址: ${pairAddress} (类型: ${pairType})`);

    // 验证合约代码存在 - 添加超时保护
    let codeStr: string;
    try {
      const codePromise = publicClient.getCode({ address: pairAddress as Hex }) as Promise<Hex | null>;
      const codeResult = await Promise.race<Hex | null>([
        codePromise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Code 查询超时')), 5000))
      ]);
      codeStr = codeResult ?? '0x';
    } catch (error) {
      console.error(`[pools] ${chainKey} 链 Code 查询失败:`, error);
      return pools;
    }

    if (!codeStr || codeStr === '0x') {
      console.log(`[pools] ${chainKey} 链交易对合约不存在`);
      return pools;
    }

    // 获取交易对信息 - 添加超时保护
    let token0: string, token1: string, reserves: any;
    try {
      const [token0Promise, token1Promise, reservesPromise] = [
        publicClient.readContract({
          address: pairAddress as Hex,
          abi: PAIR_ABI,
          functionName: 'token0',
        }),
        publicClient.readContract({
          address: pairAddress as Hex,
          abi: PAIR_ABI,
          functionName: 'token1',
        }),
        publicClient.readContract({
          address: pairAddress as Hex,
          abi: PAIR_ABI,
          functionName: 'getReserves',
        }),
      ];

      [token0, token1, reserves] = await Promise.race<[string, string, any]>([
        Promise.all([
          token0Promise as Promise<string>,
          token1Promise as Promise<string>,
          reservesPromise as Promise<any>
        ]),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Pair 信息查询超时')), 8000))
      ]);
    } catch (error) {
      console.error(`[pools] ${chainKey} 链 Pair 信息查询失败:`, error);
      return pools;
    }

    const [reserve0, reserve1, blockTimestamp] = reserves as [bigint, bigint, number];

    // 获取代币符号和精度 - 添加错误处理
    let token0Symbol = 'TOKEN0', token1Symbol = 'TOKEN1';
    let token0Decimals = 18, token1Decimals = 18;
    
    try {
      const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
        getTokenInfo(publicClient, token0 as string).then(info => info.symbol).catch(() => 'TOKEN0'),
        getTokenInfo(publicClient, token1 as string).then(info => info.symbol).catch(() => 'TOKEN1'),
        getTokenInfo(publicClient, token0 as string).then(info => info.decimals).catch(() => 18),
        getTokenInfo(publicClient, token1 as string).then(info => info.decimals).catch(() => 18),
      ]);
      
      token0Symbol = symbol0;
      token1Symbol = symbol1;
      token0Decimals = decimals0;
      token1Decimals = decimals1;
    } catch (error) {
      console.warn(`[pools] ${chainKey} 链获取代币信息失败:`, error);
    }

    // 计算 USDT 价格
    let usdtPrice = 0;
    try {
      if (pairType === 'stablecoin' && pairTokenAddress) {
        const pairTokLower = pairTokenAddress.toLowerCase();
        // 稳定币交易对 - 直接计算价格
        if (token0.toLowerCase() === pairTokLower) {
          // token1 是我们分析的代币，token0 是稳定币
          const token1Amount = parseFloat(formatUnits(reserve1, token1Decimals));
          const token0Amount = parseFloat(formatUnits(reserve0, token0Decimals));
          usdtPrice = token0Amount > 0 ? token1Amount / token0Amount : 0;
        } else if (token1.toLowerCase() === pairTokLower) {
          // token0 是我们分析的代币，token1 是稳定币
          const token0Amount = parseFloat(formatUnits(reserve0, token0Decimals));
          const token1Amount = parseFloat(formatUnits(reserve1, token1Decimals));
          usdtPrice = token1Amount > 0 ? token0Amount / token1Amount : 0;
        }
      } else if (pairType === 'wrapped' && pairTokenAddress && stablecoinAddress) {
        // 原生代币交易对 - 需要获取原生代币对稳定币的价格
        try {
          // 获取原生代币对稳定币的价格（例如 WBNB/USDT）
          const nativeStablePairPromise = publicClient.readContract({
            address: factoryAddr as Hex,
            abi: FACTORY_ABI,
            functionName: 'getPair',
            args: [pairTokenAddress as Hex, stablecoinAddress as Hex],
          }) as Promise<string>;
          
          const nativeStablePair = await Promise.race([
            nativeStablePairPromise,
            new Promise<string>((_, reject) => 
              setTimeout(() => reject(new Error('原生代币-稳定币交易对查询超时')), 5000)
            )
          ]);
          
          const zeroAddress = '0x0000000000000000000000000000000000000000';
          if (nativeStablePair && nativeStablePair.toLowerCase() !== zeroAddress) {
            // 获取原生代币对稳定币的储备
            const [nativeToken0, nativeToken1, nativeReserves] = await Promise.all<[
              string,
              string,
              any
            ]>([
              publicClient.readContract({ address: nativeStablePair as Hex, abi: PAIR_ABI, functionName: 'token0' }) as Promise<string>,
              publicClient.readContract({ address: nativeStablePair as Hex, abi: PAIR_ABI, functionName: 'token1' }) as Promise<string>,
              publicClient.readContract({ address: nativeStablePair as Hex, abi: PAIR_ABI, functionName: 'getReserves' }) as Promise<any>,
            ]);
            
            const [nativeReserve0, nativeReserve1] = nativeReserves as [bigint, bigint, number];
            
            // 计算原生代币对稳定币的价格
            let nativeToStablePrice = 0;
            if (nativeToken0.toLowerCase() === stablecoinAddress.toLowerCase()) {
              nativeToStablePrice = parseFloat(formatUnits(nativeReserve0, 18)) / parseFloat(formatUnits(nativeReserve1, 18));
            } else if (nativeToken1.toLowerCase() === stablecoinAddress.toLowerCase()) {
              nativeToStablePrice = parseFloat(formatUnits(nativeReserve1, 18)) / parseFloat(formatUnits(nativeReserve0, 18));
            }
            
            // 计算代币对稳定币的价格
            const pairTokLower = pairTokenAddress.toLowerCase();
            if (token0.toLowerCase() === pairTokLower) {
              const token1Amount = parseFloat(formatUnits(reserve1, token1Decimals));
              const nativeAmount = parseFloat(formatUnits(reserve0, token0Decimals));
              usdtPrice = nativeAmount > 0 ? (token1Amount / nativeAmount) * nativeToStablePrice : 0;
            } else if (token1.toLowerCase() === pairTokLower) {
              const token0Amount = parseFloat(formatUnits(reserve0, token0Decimals));
              const nativeAmount = parseFloat(formatUnits(reserve1, token1Decimals));
              usdtPrice = nativeAmount > 0 ? (token0Amount / nativeAmount) * nativeToStablePrice : 0;
            }
          }
        } catch (priceError) {
          console.warn(`[pools] 计算原生代币交易对价格失败:`, priceError);
        }
      }
    } catch (priceError) {
      console.warn(`[pools] 计算价格失败:`, priceError);
    }

    pools.push({
      dex: dexInfo.name,
      chain: chainKey,
      pairAddress: pairAddress.toLowerCase(),
      token0: token0.toLowerCase(),
      token1: token1.toLowerCase(),
      reserve0: reserve0.toString(),
      reserve1: reserve1.toString(),
      token0Symbol,
      token1Symbol,
      token0Decimals,
      token1Decimals,
      usdtPrice,
      blockTimestamp,
    });

    const pairTypeText = pairType === 'stablecoin' ? '稳定币' : '原生代币';
    console.log(`[pools] 找到 ${chainKey} 链 ${pairTypeText} 交易池: ${token0Symbol}/${token1Symbol}, 价格: $${usdtPrice.toFixed(6)}`);

  } catch (error) {
    console.error(`[pools] 分析 ${chainKey} 链失败:`, error);
  }

  return pools;
}

/**
 * 获取代币信息（符号和精度）
 */
async function getTokenInfo(publicClient: any, address: string): Promise<{ symbol: string; decimals: number }> {
  try {
    const [symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: address as Hex,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }).catch(() => 'TOKEN'),
      publicClient.readContract({
        address: address as Hex,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }).catch(() => 18),
    ]);

    return {
      symbol: symbol as string,
      decimals: decimals as number,
    };
  } catch (error) {
    console.warn(`[pools] 获取代币 ${address} 信息失败:`, error);
    return { symbol: 'TOKEN', decimals: 18 };
  }
}