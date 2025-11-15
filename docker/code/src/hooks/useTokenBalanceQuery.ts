'use client';

import { useState, useCallback } from 'react';

export interface TokenBalanceData {
  token: {
    id: number;
    chain: string;
    address: string;
  };
  balance: {
    balance_wei: string;
    balance_eth: string;
    usd_value: number;
  };
  cached: boolean;
  lastUpdated: string;
}

interface UseTokenBalanceQueryReturn {
  balanceData: TokenBalanceData | null;
  isLoading: boolean;
  error: string | null;
  queryTokenBalance: (tokenId: number, walletAddress: string) => Promise<void>;
  clearError: () => void;
}

export function useTokenBalanceQuery(): UseTokenBalanceQueryReturn {
  const [balanceData, setBalanceData] = useState<TokenBalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryTokenBalance = useCallback(async (tokenId: number, walletAddress: string) => {
    if (!walletAddress) {
      setError('钱包地址不能为空');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/balances/token-balance/${tokenId}?walletAddress=${walletAddress}`);
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
      console.error('查询代币余额失败:', err);
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
    queryTokenBalance,
    clearError,
  };
}