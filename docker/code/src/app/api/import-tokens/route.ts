import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// 获取导入的代币列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain');
    
    let query = 'SELECT * FROM imported_tokens';
    let params: string[] = [];
    
    if (chain) {
      query += ' WHERE chain = ?';
      params.push(chain);
    }
    
    query += ' ORDER BY created_at DESC';
    
  const [rows] = await pool.execute(query, params);
  
  // 获取已存储的钱包余额数据
  const tokens = rows as any[];
  const walletAddresses = [...new Set(tokens.map(t => t.address.toLowerCase()))];
  const tokenIds = tokens.map(t => t.id).filter((id: any) => typeof id === 'number');
    
    if (walletAddresses.length > 0) {
      // 获取所有相关的钱包余额数据
      const walletBalanceQuery = `
        SELECT wallet_address, chain, total_usd_value, token_count, tokens, last_updated
        FROM wallet_balance_summary
        WHERE wallet_address IN (${walletAddresses.map(() => '?').join(',')})
        ${chain ? 'AND chain = ?' : ''}
        AND last_updated > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `;
      
      const walletBalanceParams = chain 
        ? [...walletAddresses, chain]
        : walletAddresses;
      
      const [balanceRows] = await pool.execute(walletBalanceQuery, walletBalanceParams);
      const balanceData = balanceRows as any[];
      
      // 创建余额数据映射
      const balanceMap = new Map();
      balanceData.forEach(balance => {
        const key = `${balance.wallet_address}-${balance.chain}`;
        balanceMap.set(key, {
          totalUsdValue: parseFloat(balance.total_usd_value),
          tokenCount: balance.token_count,
          tokens: typeof balance.tokens === 'string' ? JSON.parse(balance.tokens) : balance.tokens,
          lastUpdated: balance.last_updated
        });
      });
      
      // 为每个代币添加余额信息
      tokens.forEach(token => {
        const key = `${token.address.toLowerCase()}-${token.chain}`;
        const balanceInfo = balanceMap.get(key);
        
        if (balanceInfo) {
          token.totalUsdValue = balanceInfo.totalUsdValue;
          token.tokenCount = balanceInfo.tokenCount;
          token.lastBalanceUpdate = balanceInfo.lastUpdated;
        }
      });
    }
    
    // 为每个代币附加交易池数量（从缓存表中读取最新且未过期的数据）
    if (tokenIds.length > 0) {
      const poolCacheQuery = `
        SELECT token_id, chain, pool_count, expires_at, updated_at
        FROM token_pools_cache
        WHERE token_id IN (${tokenIds.map(() => '?').join(',')})
        ${chain ? 'AND chain = ?' : ''}
        AND expires_at > NOW()
        ORDER BY updated_at DESC
      `;

      const poolCacheParams = chain ? [...tokenIds, chain] : tokenIds;
      const [poolRows] = await pool.execute(poolCacheQuery, poolCacheParams);
      const poolData = poolRows as any[];

      const poolMap = new Map<string, { poolCount: number }>();
      poolData.forEach((pr: any) => {
        const key = `${pr.token_id}-${pr.chain}`;
        if (!poolMap.has(key)) {
          poolMap.set(key, { poolCount: Number(pr.pool_count) || 0 });
        }
      });

      tokens.forEach(token => {
        const key = `${token.id}-${token.chain}`;
        const poolInfo = poolMap.get(key);
        const existing = (() => {
          const n = Number(token.pool);
          return Number.isFinite(n) && n >= 0 ? n : 0;
        })();
        if (poolInfo) {
          const cached = Number(poolInfo.poolCount);
          const final = Number.isFinite(cached) && cached >= 0 ? Math.max(existing, cached) : existing;
          token.pool = String(final);
        } else {
          token.pool = String(existing);
        }
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      tokens: tokens 
    });
  } catch (error) {
    console.error('获取代币列表失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '获取代币列表失败' 
      },
      { status: 500 }
    );
  }
}

// 批量导入代币地址
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chain, addresses } = body;
    
    if (!chain || !addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '缺少必要参数' 
        },
        { status: 400 }
      );
    }
    
    // 验证链类型
    const validChains = ['bsc', 'eth', 'polygon', 'arbitrum', 'optimism'];
    if (!validChains.includes(chain)) {
      return NextResponse.json(
        { 
          success: false, 
          error: '无效的链类型' 
        },
        { status: 400 }
      );
    }
    
    // 验证地址格式
    const validAddresses = addresses.filter(addr => 
      /^0x[a-fA-F0-9]{40}$/.test(addr)
    ).map(addr => addr.toLowerCase());
    
    if (validAddresses.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '没有有效的地址' 
        },
        { status: 400 }
      );
    }
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      let inserted = 0;
      let duplicates = 0;
      
      for (const address of validAddresses) {
        try {
          await connection.execute(
            'INSERT INTO imported_tokens (chain, address, color) VALUES (?, ?, ?)',
            [chain, address, '']
          );
          inserted++;
        } catch (error: any) {
          if (error.code === 'ER_DUP_ENTRY') {
            duplicates++;
          } else {
            throw error;
          }
        }
      }
      
      await connection.commit();
      
      return NextResponse.json({ 
        success: true, 
        inserted, 
        duplicates 
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('导入代币地址失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '导入失败' 
      },
      { status: 500 }
    );
  }
}