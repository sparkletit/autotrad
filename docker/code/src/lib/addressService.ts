/**
 * 地址和数据获取服务
 * 提供统一的账户、别名、代币数据获取接口
 */

export interface Account {
  id: number;
  account_name: string;
  address: string;
  type: 'main' | 'derived';
}

export interface AddressAlias {
  id: number;
  alias: string;
  address: string;
}

export interface CustomToken {
  id?: number;
  symbol: string;
  address: string;
  decimals: number;
  contract_address?: string;
}

/**
 * 获取所有账户（主账号 + 派生账号）
 */
export const fetchAllAccounts = async (): Promise<Account[]> => {
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

      const allAccounts: Account[] = [...mainAccounts];

      // 获取派生账号
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
          console.error(`获取主账号${mainAccount.id}的派生账号失败:`, err);
        }
      }

      return allAccounts;
    }
    return [];
  } catch (err) {
    console.error('获取账户列表失败:', err);
    return [];
  }
};

/**
 * 获取地址别名列表
 */
export const fetchAddressAliases = async (): Promise<AddressAlias[]> => {
  try {
    const response = await fetch('/api/address-aliases/search');
    const data = await response.json();
    if (data.success) {
      return data.data || [];
    }
    return [];
  } catch (err) {
    console.error('获取地址别名失败:', err);
    return [];
  }
};

/**
 * 获取自定义代币列表
 */
export const fetchCustomTokens = async (): Promise<CustomToken[]> => {
  try {
    const response = await fetch('/api/custom-tokens');
    const data = await response.json();
    if (data.success) {
      return data.data || [];
    }
    return [];
  } catch (err) {
    console.error('获取自定义代币失败:', err);
    return [];
  }
};

/**
 * 获取账户余额（统一使用 /api/balance-checker）
 * @param address 账户地址
 * @param tokens 可选，要查询的代币对象列表，如 [{ address, symbol, decimals }]
 * @param network 可选，网络标识，默认 'fork'
 */
export const fetchTokenBalances = async (
  address: string,
  tokens?: CustomToken[],
  network: string = 'fork'
) => {
  try {
    const params = new URLSearchParams({ address, network });

    if (tokens && tokens.length > 0) {
      const payload = tokens.map((t) => ({
        address: t.address,
        symbol: t.symbol,
        decimals: t.decimals,
      }));
      params.set('tokens', JSON.stringify(payload));
    }

    const response = await fetch(`/api/balance-checker?${params.toString()}`);
    const data = await response.json();
    if (data.success) {
      // /api/balance-checker 返回 { data: { address, balances } }
      return (data.data && Array.isArray(data.data.balances)) ? data.data.balances : [];
    }
    return [];
  } catch (err) {
    console.error('获取代币余额失败:', err);
    return [];
  }
};

/**
 * 验证以太坊地址格式
 */
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * 格式化地址显示
 */
export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
