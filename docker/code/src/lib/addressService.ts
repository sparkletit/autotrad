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
 * 获取账户余额
 */
export const fetchTokenBalances = async (address: string) => {
  try {
    const response = await fetch(`/api/accounts/${address}/balances`);
    const data = await response.json();
    if (data.success) {
      return data.data || [];
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
