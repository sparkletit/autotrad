'use client';

import { useState, useCallback } from 'react';

export interface TokenBalance {
  token_symbol: string;
  token_name: string;
  balance_wei: string;
  balance_eth: string;
  usd_value: number;
  decimals: number;
  logo_url?: string;
}

export interface BalanceData {
  walletAddress: string;
  totalUsdValue: number;
  tokenCount: number;
  balances: TokenBalance[];
  cached: boolean;
  lastUpdated: string;
}

interface UseBalanceQueryReturn {
  balanceData: BalanceData | null;
  isLoading: boolean;
  error: string | null;
  queryBalance: (walletAddress: string, chain?: string) => Promise<void>;
  clearError: () => void;
}

export function useBalanceQuery(): UseBalanceQueryReturn {
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryBalance = useCallback(async (walletAddress: string, chain: string = 'bnb-mainnet') => {
    if (!walletAddress) {
      setError('钱包地址不能为空');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/balances/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          chain,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || '查询余额失败');
      }

      if (!result.success) {
        throw new Error(result.message || '查询余额失败');
      }

      setBalanceData(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '查询余额时发生未知错误';
      setError(errorMessage);
      console.error('查询余额失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    balanceData,
    isLoading,
    error,
    queryBalance,
    clearError,
  };
}