'use client';

import { useState, useEffect } from 'react';

interface MainAccount {
  id: number;
  account_name: string;
  address: string;
  mnemonic: string;
  private_key: string;
}

interface DerivedAccount {
  id: number;
  account_name: string;
  address: string;
  private_key: string;
  derivation_path: string;
  index_num: number;
}

interface IdentityConfigurationProps {
  onAccountSelected?: (account: MainAccount | DerivedAccount, isMainAccount: boolean) => void;
}

export default function IdentityConfiguration({ onAccountSelected }: IdentityConfigurationProps) {
  const [mainAccounts, setMainAccounts] = useState<MainAccount[]>([]);
  const [derivedAccounts, setDerivedAccounts] = useState<DerivedAccount[]>([]);
  const [selectedMainAccountId, setSelectedMainAccountId] = useState<number | null>(null);
  const [selectedAccountAddress, setSelectedAccountAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // 获取主账号列表
  useEffect(() => {
    fetchMainAccounts();
  }, []);

  const fetchMainAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/address-books/main-accounts');
      const data = await response.json();

      if (data.success) {
        setMainAccounts(data.data || []);
      } else {
        setError('获取主账号失败: ' + (data.error || '未知错误'));
      }
    } catch (err) {
      console.error('获取主账号失败:', err);
      setError('获取主账号失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取派生账号列表
  const handleMainAccountChange = async (mainAccountId: number) => {
    setSelectedMainAccountId(mainAccountId);
    setDerivedAccounts([]);
    setSelectedAccountAddress('');

    try {
      const response = await fetch(`/api/address-books/main-accounts/${mainAccountId}/derived-accounts`);
      const data = await response.json();

      if (data.success) {
        setDerivedAccounts(data.data || []);
      }
    } catch (err) {
      console.error('获取派生账号失败:', err);
    }
  };

  // 处理账号选择
  const handleSelectAccount = (address: string, isMainAccount: boolean) => {
    setSelectedAccountAddress(address);

    if (isMainAccount) {
      const account = mainAccounts.find((a) => a.address === address);
      if (account) {
        onAccountSelected?.(account, true);
      }
    } else {
      const account = derivedAccounts.find((a) => a.address === address);
      if (account) {
        onAccountSelected?.(account, false);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-6 text-gray-900">用户身份配置</h2>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : (
        <div className="space-y-4">
          {/* 主账号选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              选择主账号
            </label>
            <select
              value={selectedMainAccountId || ''}
              onChange={(e) => handleMainAccountChange(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- 选择主账号 --</option>
              {(mainAccounts || []).map((account) => (
                <option key={account.id} value={account.id} className="text-gray-900">
                  {account.account_name} ({account.address.slice(0, 6)}...
                  {account.address.slice(-4)})
                </option>
              ))}
            </select>
          </div>

          {/* 当前选择的主账号 */}
          {selectedMainAccountId && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-600">当前主账号</p>
                <button
                  onClick={() =>
                    handleSelectAccount(
                      (mainAccounts || []).find((a) => a.id === selectedMainAccountId)?.address || '',
                      true
                    )
                  }
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  选择此账号
                </button>
              </div>
              {(mainAccounts || [])
                .filter((a) => a.id === selectedMainAccountId)
                .map((account) => (
                  <div key={account.id} className="text-sm">
                    <p className="text-gray-900 font-medium">{account.account_name}</p>
                    <p className="text-gray-600 break-all font-mono text-xs mt-1">
                      {account.address}
                    </p>
                  </div>
                ))}
            </div>
          )}

          {/* 派生账号列表 */}
          {selectedMainAccountId && (derivedAccounts || []).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                派生账号列表
              </label>
              <div className="space-y-2">
                {(derivedAccounts || []).map((account) => (
                  <div
                    key={account.id}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedAccountAddress === account.address
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                    }`}
                    onClick={() => handleSelectAccount(account.address, false)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {account.account_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          路径: {account.derivation_path}
                        </p>
                        <p className="text-xs text-gray-600 break-all font-mono mt-1">
                          {account.address}
                        </p>
                      </div>
                      {selectedAccountAddress === account.address && (
                        <span className="text-blue-600 font-bold">✓</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedMainAccountId && (derivedAccounts || []).length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              暂无派生账号，请在地址本中添加
            </p>
          )}
        </div>
      )}
    </div>
  );
}
