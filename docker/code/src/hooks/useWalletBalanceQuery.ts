'use client';

import { useState, useCallback } from 'react';

export interface TokenBalanceInfo {
  tokenAddress: string | null;
  symbol: string;
  name: string;
  decimals: number;
  balanceWei: string;
  balanceEth: string;
  usdValue: number;
  logo?: string;
}

export interface WalletBalanceData {
  wallet_address: string;
  chain: string;
  total_usd_value: number;
  token_count: number;
  tokens: TokenBalanceInfo[];
  cached: boolean;
  lastUpdated: string;
}

interface UseWalletBalanceQueryReturn {
  walletBalanceData: WalletBalanceData | null;
  isLoading: boolean;
  error: string | null;
  queryWalletBalance: (walletAddress: string, chain: string) => Promise<void>;
  clearError: () => void;
}

export function useWalletBalanceQuery(): UseWalletBalanceQueryReturn {
  const [walletBalanceData, setWalletBalanceData] = useState<WalletBalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryWalletBalance = useCallback(async (walletAddress: string, chain: string) => {
    if (!walletAddress) {
      setError('钱包地址不能为空');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/balances/wallet-balance?walletAddress=${walletAddress}&chain=${chain}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || '查询余额失败');
      }

      if (!result.success) {
        throw new Error(result.message || '查询余额失败');
      }

      setWalletBalanceData(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '查询余额时发生未知错误';
      setError(errorMessage);
      console.error('查询钱包余额失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    walletBalanceData,
    isLoading,
    error,
    queryWalletBalance,
    clearError,
  };
}