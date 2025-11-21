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

// 额外 DEX Factory 列表（覆盖更多 DEX）
const DEX_FACTORY_LIST: Record<string, Array<{ name: string; address: string; chain: any }>> = {
  bsc: [
    { name: 'PancakeSwap V2', address: '0xca143ce32fe78f1f7019d7d551a6402fc5350c73', chain: bsc },
    { name: 'BakerySwap', address: '0x01bF7C66c6BD861915CdaaE475042d3b4f775595', chain: bsc },
    { name: 'ApeSwap', address: '0x0841BD0B734E4F5853f0dD8d7Ea041c241fb0Da6', chain: bsc },
    { name: 'Biswap', address: '0x858E3312ed3A876341EA81A4aC0C2d2FCbd07a82', chain: bsc },
  ],
  ethereum: [
    { name: 'Uniswap V2', address: '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f', chain: mainnet },
    { name: 'SushiSwap', address: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', chain: mainnet },
    { name: 'ShibaSwap', address: '0x115934131916c8b277f010928e7b147fac2c77b8', chain: mainnet },
  ],
  polygon: [
    { name: 'QuickSwap', address: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32', chain: polygon },
    { name: 'SushiSwap', address: '0xc35DADB65012eC5796536Bd9864ED8773aBc74C4', chain: polygon },
    { name: 'ApeSwap', address: '0xCf083Be4164828f00cAEbE3e17cBf474522a9eD9', chain: polygon },
  ],
  arbitrum: [
    { name: 'SushiSwap', address: '0xc35DADB65012eC5796536Bd9864ED8773aBc74C4', chain: arbitrum },
  ],
  optimism: [
    { name: 'Velodrome', address: '0x25cbddb98b35ab1ff77413456b31ec81a6ad6eeb', chain: optimism },
  ],
};

// Stablecoin addresses for price calculation
const STABLECOINS = {
  bsc: '0x55d398326f99059ff775485246999027b3197955', // USDT
  ethereum: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  polygon: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', // USDT
  arbitrum: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT
  optimism: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', // USDT
};

// Multiple stablecoins per chain (to发现更多交易池)
const STABLECOIN_LIST: Record<string, string[]> = {
  bsc: [
    '0x55d398326f99059ff775485246999027b3197955', // USDT
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
    '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD (legacy)
    '0x1AF3F329e8BE154074D8769B97B1E2E8d2c9Bf05', // DAI (BSC)
  ],
  ethereum: [
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
  ],
  polygon: [
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', // USDT
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
  ],
  arbitrum: [
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT
    '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', // USDC.e
  ],
  optimism: [
    '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', // USDT
    '0x7F5c764cbc14f9669B88837ca1490cCa17c31607', // USDC
  ],
};

// WETH/WBNB addresses for additional pair analysis
const WRAPPED_NATIVE_TOKENS = {
  bsc: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  polygon: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
  arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
  optimism: '0x4200000000000000000000000000000000000006', // WETH
};

// 常见主流代币（用于更广的候选枚举）
const COMMON_TOKENS_LIST: Record<string, string[]> = {
  bsc: [
    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
    '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', // CAKE
    '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // BTCB
    '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // ETH (Binance-Peg)
  ],
  ethereum: [
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606EB48', // USDC
    '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
  ],
  polygon: [
    '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
  ],
  arbitrum: [
    '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
  ],
  optimism: [
    '0x4200000000000000000000000000000000000006', // WETH
  ],
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

function normalizeChainKey(key: string): keyof typeof DEX_FACTORIES | keyof typeof STABLECOINS | keyof typeof WRAPPED_NATIVE_TOKENS | keyof typeof STABLECOIN_LIST {
  const k = key.toLowerCase();
  if (k === 'eth' || k === 'ethereum') return 'ethereum';
  if (k === 'bsc' || k === 'bnb' || k === 'bsc-mainnet') return 'bsc';
  if (k === 'matic' || k === 'polygon') return 'polygon';
  if (k === 'arb' || k === 'arbitrum') return 'arbitrum';
  if (k === 'op' || k === 'optimism') return 'optimism';
  return k as any;
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
    const tokenChain = normalizeChainKey(token.chain);
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

    chainKey = normalizeChainKey(chainKey) as string;
    const stablecoinAddress = STABLECOINS[chainKey as keyof typeof STABLECOINS];
    const wrappedNativeAddress = WRAPPED_NATIVE_TOKENS[chainKey as keyof typeof WRAPPED_NATIVE_TOKENS];
    
    if (!stablecoinAddress && !wrappedNativeAddress) {
      console.warn(`[pools] ${chainKey} 链没有配置稳定币或原生代币地址`);
      return pools;
    }

    // 获取与多稳定币/原生代币的交易对（尽可能多地发现池）
    const tokenAddr = getAddress(tokenAddress);
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const stableList = STABLECOIN_LIST[chainKey] || (stablecoinAddress ? [stablecoinAddress] : []);
    const candidates: Array<{ type: 'stablecoin' | 'wrapped' | 'common'; addr: string }> = [
      ...stableList.map(a => ({ type: 'stablecoin' as const, addr: getAddress(a) })),
      ...(wrappedNativeAddress ? [{ type: 'wrapped' as const, addr: getAddress(wrappedNativeAddress) }] : []),
      ...((COMMON_TOKENS_LIST[chainKey] || []).map(a => ({ type: 'common' as const, addr: getAddress(a) })))
    ];
    // 补充：如果 imported_tokens 表中的链为 'eth'，但 DEX_FACTORIES 走 'ethereum'，已在 normalizeChainKey 统一
    // 再补充：当 token 是稳定币本身时，排除 cand.addr 与 tokenAddr 相同导致价格计算为1的情况
    const tokenIsStable = stableList.some(a => getAddress(a).toLowerCase() === tokenAddr.toLowerCase());
    const filteredCandidates = candidates;
    const seenPairs = new Set<string>();

    const factories = DEX_FACTORY_LIST[chainKey] || (dexInfo ? [dexInfo] : []);
    for (const factory of factories) {
      const factoryAddr = getAddress(factory.address);
      for (const cand of filteredCandidates) {
      let pairAddress: string | null = null;
      try {
        const pairPromise = publicClient.readContract({ address: factoryAddr as Hex, abi: FACTORY_ABI, functionName: 'getPair', args: [tokenAddr as Hex, cand.addr as Hex] }) as Promise<string>;
        pairAddress = await Promise.race([
          pairPromise,
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Factory 查询超时')), 5000))
        ]);
      } catch {
        continue;
      }
      if (!pairAddress || pairAddress.toLowerCase() === zeroAddress) continue;
      const key = pairAddress.toLowerCase();
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);

      // 验证合约存在（非强制）：若查询失败不拦截，交由后续读方法兜底
      let codeStr: Hex | null = null;
      try {
        const codePromise = publicClient.getCode({ address: pairAddress as Hex }) as Promise<Hex | null>;
        codeStr = await Promise.race([
          codePromise,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Code 查询超时')), 8000))
        ]);
      } catch {}
      // 若读取代码失败或返回空，也继续尝试读取 token0/token1/reserves

      // 读取pair信息
      let token0: string, token1: string, reserves: readonly [bigint, bigint, number];
      try {
        const [token0Promise, token1Promise, reservesPromise] = [
          publicClient.readContract({ address: pairAddress as Hex, abi: PAIR_ABI, functionName: 'token0' }) as Promise<string>,
          publicClient.readContract({ address: pairAddress as Hex, abi: PAIR_ABI, functionName: 'token1' }) as Promise<string>,
          publicClient.readContract({ address: pairAddress as Hex, abi: PAIR_ABI, functionName: 'getReserves' }) as Promise<readonly [bigint, bigint, number]>,
        ];
        const tupleP = Promise.all([
          token0Promise,
          token1Promise,
          reservesPromise
        ] as const);
        [token0, token1, reserves] = await Promise.race([
          tupleP,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Pair 信息查询超时')), 12000))
        ]);
      } catch { continue; }

      const [reserve0, reserve1, blockTimestamp] = reserves;
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
      } catch {}

      // 价格计算（稳定币：直接比值；原生包装：通过其与首选稳定币的池折算）
      let usdtPrice = 0;
      try {
        if (cand.type === 'stablecoin') {
          const pairTokLower = cand.addr.toLowerCase();
          if (token0.toLowerCase() === pairTokLower) {
            const token1Amount = parseFloat(formatUnits(reserve1, token1Decimals));
            const token0Amount = parseFloat(formatUnits(reserve0, token0Decimals));
            usdtPrice = token0Amount > 0 ? token1Amount / token0Amount : 0;
          } else if (token1.toLowerCase() === pairTokLower) {
            const token0Amount = parseFloat(formatUnits(reserve0, token0Decimals));
            const token1Amount = parseFloat(formatUnits(reserve1, token1Decimals));
            usdtPrice = token1Amount > 0 ? token0Amount / token1Amount : 0;
          }
          // 若 pairTokLower 与 tokenAddr 相同（代币是稳定币本身），此池价格含义不应记为1；保留但不会影响最终排序
        } else if (cand.type === 'wrapped') {
          // 选取稳定币列表中储备更充足的作为折算依据（简单优先第一个）
          const baseStable = stableList[0];
          if (baseStable) {
            try {
              const nativeStablePairPromise = publicClient.readContract({ address: factoryAddr as Hex, abi: FACTORY_ABI, functionName: 'getPair', args: [cand.addr as Hex, getAddress(baseStable) as Hex] }) as Promise<string>;
              const nativeStablePair = await Promise.race([
                nativeStablePairPromise,
                new Promise<string>((_, reject) => setTimeout(() => reject(new Error('原生代币-稳定币交易对查询超时')), 5000))
              ]);
              if (nativeStablePair && nativeStablePair.toLowerCase() !== zeroAddress) {
                const nativeToken0P = publicClient.readContract({ address: nativeStablePair as Hex, abi: PAIR_ABI, functionName: 'token0' }) as Promise<string>;
                const nativeToken1P = publicClient.readContract({ address: nativeStablePair as Hex, abi: PAIR_ABI, functionName: 'token1' }) as Promise<string>;
                const nativeReservesP = publicClient.readContract({ address: nativeStablePair as Hex, abi: PAIR_ABI, functionName: 'getReserves' }) as Promise<readonly [bigint, bigint, number]>;
                const [nativeToken0, nativeToken1, nativeReserves] = await Promise.all([
                  nativeToken0P,
                  nativeToken1P,
                  nativeReservesP,
                ] as const);
                const [nativeReserve0, nativeReserve1] = nativeReserves;
                let nativeToStablePrice = 0;
                const bs = getAddress(baseStable).toLowerCase();
                if (nativeToken0.toLowerCase() === bs) {
                  // token0 是稳定币 → 稳定币储备 / 原生储备 = 稳定币价格/原生
                  nativeToStablePrice = parseFloat(formatUnits(nativeReserve0, 18)) / parseFloat(formatUnits(nativeReserve1, 18));
                } else if (nativeToken1.toLowerCase() === bs) {
                  // token1 是稳定币 → 稳定币储备 / 原生储备
                  nativeToStablePrice = parseFloat(formatUnits(nativeReserve1, 18)) / parseFloat(formatUnits(nativeReserve0, 18));
                }
                const pairTokLower = cand.addr.toLowerCase();
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
            } catch {}
          }
        } else if (cand.type === 'common') {
          // 通过“候选代币→稳定币”的价格来折算此池的USD价格
          const baseStable = stableList[0];
          if (baseStable) {
            try {
              const commonStablePairPromise = publicClient.readContract({ address: factoryAddr as Hex, abi: FACTORY_ABI, functionName: 'getPair', args: [cand.addr as Hex, getAddress(baseStable) as Hex] }) as Promise<string>;
              const commonStablePair = await Promise.race([
                commonStablePairPromise,
                new Promise<string>((_, reject) => setTimeout(() => reject(new Error('候选代币-稳定币交易对查询超时')), 5000))
              ]);
              if (commonStablePair && commonStablePair.toLowerCase() !== zeroAddress) {
                const cToken0P = publicClient.readContract({ address: commonStablePair as Hex, abi: PAIR_ABI, functionName: 'token0' }) as Promise<string>;
                const cToken1P = publicClient.readContract({ address: commonStablePair as Hex, abi: PAIR_ABI, functionName: 'token1' }) as Promise<string>;
                const cReservesP = publicClient.readContract({ address: commonStablePair as Hex, abi: PAIR_ABI, functionName: 'getReserves' }) as Promise<readonly [bigint, bigint, number]>;
                const [cToken0, cToken1, cReserves] = await Promise.all([
                  cToken0P,
                  cToken1P,
                  cReservesP,
                ] as const);
                const [cReserve0, cReserve1] = cReserves;
                const bs = getAddress(baseStable).toLowerCase();
                let commonToStablePrice = 0;
                if (cToken0.toLowerCase() === bs) {
                  commonToStablePrice = parseFloat(formatUnits(cReserve0, 18)) / parseFloat(formatUnits(cReserve1, 18));
                } else if (cToken1.toLowerCase() === bs) {
                  commonToStablePrice = parseFloat(formatUnits(cReserve1, 18)) / parseFloat(formatUnits(cReserve0, 18));
                }
                const pairTokLower = cand.addr.toLowerCase();
                if (token0.toLowerCase() === pairTokLower) {
                  const token1Amount = parseFloat(formatUnits(reserve1, token1Decimals));
                  const commonAmount = parseFloat(formatUnits(reserve0, token0Decimals));
                  usdtPrice = commonAmount > 0 ? (token1Amount / commonAmount) * commonToStablePrice : 0;
                } else if (token1.toLowerCase() === pairTokLower) {
                  const token0Amount = parseFloat(formatUnits(reserve0, token0Decimals));
                  const commonAmount = parseFloat(formatUnits(reserve1, token1Decimals));
                  usdtPrice = commonAmount > 0 ? (token0Amount / commonAmount) * commonToStablePrice : 0;
                }
              }
            } catch {}
          }
        }
      } catch {}

      pools.push({
        dex: factory.name,
        chain: chainKey,
        pairAddress: key,
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
      }
    }

    pools.sort((a, b) => b.usdtPrice - a.usdtPrice);

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