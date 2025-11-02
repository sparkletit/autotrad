import { useState, useEffect } from 'react';

export interface Account {
  id: number;
  account_name: string;
  address: string;
  type: 'main' | 'derived';
}

interface UseAccountsState {
  accounts: Account[];
  loading: boolean;
  error: string | null;
}

/**
 * 获取账户列表Hook
 * 自动加载主账号和派生账号
 * 支持手动刷新
 */
function useAccounts() {
  const [state, setState] = useState<UseAccountsState>({
    accounts: [],
    loading: false,
    error: null,
  });

  const fetchAccounts = async () => {
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const response = await fetch('/api/address-books/main-accounts');
      const data = await response.json();

      if (data.success) {
        const mainAccounts: Account[] = (data.data || []).map((acc: any) => ({
          id: acc.id,
          account_name: acc.account_name,
          address: acc.address,
          type: 'main' as const,
        }));

        // 获取派生账号
        const allAccounts: Account[] = [...mainAccounts];

        for (const mainAccount of mainAccounts) {
          try {
            const derivedResponse = await fetch(
              `/api/address-books/main-accounts/${mainAccount.id}/derived-accounts`
            );
            const derivedData = await derivedResponse.json();
            if (derivedData.success) {
              const derived = (derivedData.data || []).map((acc: any) => ({
                id: acc.id,
                account_name: acc.account_name,
                address: acc.address,
                type: 'derived' as const,
              }));
              allAccounts.push(...derived);
            }
          } catch (err) {
            console.error('获取派生账号失败:', err);
          }
        }

        setState({
          accounts: allAccounts,
          loading: false,
          error: null,
        });
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: data.error || 'Failed to fetch accounts',
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Network error',
      }));
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return {
    ...state,
    refresh: fetchAccounts,
  };
}

export default useAccounts;
