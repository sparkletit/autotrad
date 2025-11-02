import React, { useState, useEffect } from 'react';
import { FormSelect, FormSelectOption } from './FormInputs';

export interface Account {
  id: number;
  account_name: string;
  address: string;
  type: 'main' | 'derived';
}

interface AccountSelectorProps {
  value: string;
  onChange: (address: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

/**
 * 账户选择器组件
 * 提取Sidebar和Swap中重复的账户选择逻辑
 * 自动加载主账号和派生账号
 */
const AccountSelector: React.FC<AccountSelectorProps> = ({
  value,
  onChange,
  label = '选择账户',
  placeholder = '-- 选择账户 --',
  disabled = false,
  error,
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
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

        setAccounts(allAccounts);
      }
    } catch (err) {
      console.error('获取账户列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const options: FormSelectOption[] = accounts.map((acc) => ({
    label: `${acc.account_name} (${acc.address.slice(0, 6)}...${acc.address.slice(-4)})`,
    value: acc.address,
  }));

  return (
    <FormSelect
      label={label}
      placeholder={loading ? '加载中...' : placeholder}
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled || loading}
      error={error}
      keyPrefix="account"
    />
  );
};

export default AccountSelector;
