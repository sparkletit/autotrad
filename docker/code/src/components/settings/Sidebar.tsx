'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface Account {
  id: number;
  account_name: string;
  address: string;
  type: 'main' | 'derived';
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [showWrapModal, setShowWrapModal] = useState(false);
  const [importPrivateKey, setImportPrivateKey] = useState('');
  const [importAccountName, setImportAccountName] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [wrapAmount, setWrapAmount] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [importLoading, setImportLoading] = useState(false);
  const [mintLoading, setMintLoading] = useState(false);
  const [wrapLoading, setWrapLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);

  const configMenuItems = [
    { id: 'fork', label: 'Fork网络', icon: '🔀' },
    { id: 'identity', label: '用户身份', icon: '👤' },
    { id: 'rpc', label: 'RPC 节点', icon: '🔗' },
    { id: 'address', label: '地址别名', icon: '📍' },
  ];

  const quickActions = [
    { id: 'import-wallet', label: '添加钱包', icon: '➕' },
    { id: 'mint-bnb', label: 'Mint主网资产', icon: '💰' },
    { id: 'wrap-wbnb', label: '包装WBNB', icon: '💶' },
  ];

  // 获取账户列表
  const fetchAccounts = async () => {
    setAccountsLoading(true);
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
      setAccountsLoading(false);
    }
  };

  // 打开Mint模态框时获取账户列表
  const handleOpenMintModal = () => {
    fetchAccounts();
    setShowMintModal(true);
    setError('');
  };

  // 打开包装模态框时获取账户列表
  const handleOpenWrapModal = () => {
    fetchAccounts();
    setShowWrapModal(true);
    setError('');
  };

  // 处理导入私钥
  const handleImportWallet = async () => {
    if (!importPrivateKey.trim() || !importAccountName.trim()) {
      setError('请输入私钥和账号名称');
      return;
    }

    setImportLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/address-books/import-private-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey: importPrivateKey,
          accountName: importAccountName,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功导入钱包：${data.data.accountName}`);
        setImportPrivateKey('');
        setImportAccountName('');
        setShowImportModal(false);
      } else {
        setError(data.error || '导入失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImportLoading(false);
    }
  };

  // 处理Mint BNB
  const handleMintBNB = async () => {
    if (!selectedAddress) {
      setError('请先选择要Mint的地址');
      return;
    }

    if (!mintAmount || parseFloat(mintAmount) <= 0) {
      setError('请输入有效的BNB数量');
      return;
    }

    setMintLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/fork/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: selectedAddress,
          amount: mintAmount,
          token: 'BNB',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功Mint ${mintAmount} BNB`);
        setMintAmount('');
        setShowMintModal(false);
      } else {
        setError(data.error || 'Mint失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mint失败');
    } finally {
      setMintLoading(false);
    }
  };

  // 处理包装WBNB
  const handleWrapWBNB = async () => {
    if (!selectedAddress) {
      setError('请先选择要包装的地址');
      return;
    }

    if (!wrapAmount || parseFloat(wrapAmount) <= 0) {
      setError('请输入有效的BNB数量');
      return;
    }

    setWrapLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/swap/wrap-wbnb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: selectedAddress,
          amount: wrapAmount,
          network: 'fork',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功将 ${wrapAmount} BNB 包装为 WBNB`);
        setWrapAmount('');
        setShowWrapModal(false);
      } else {
        setError(data.error || '包装失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '包装失败');
    } finally {
      setWrapLoading(false);
    }
  };

  const handleQuickAction = (actionId: string) => {
    switch (actionId) {
      case 'import-wallet':
        setShowImportModal(true);
        break;
      case 'mint-bnb':
        handleOpenMintModal();
        break;
      case 'wrap-wbnb':
        handleOpenWrapModal();
        break;
    }
  };

  // 模态框内容组件
  const modalContent = (
    <>
      {/* 导入钱包模态框 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[999] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">导入钱包（私钥）</h3>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  账号名称
                </label>
                <input
                  type="text"
                  value={importAccountName}
                  onChange={(e) => setImportAccountName(e.target.value)}
                  placeholder="为导入的钱包取个名字"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  私钥
                </label>
                <textarea
                  value={importPrivateKey}
                  onChange={(e) => setImportPrivateKey(e.target.value)}
                  placeholder="粘贴钱包的私钥（0x开头）"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleImportWallet}
                disabled={importLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {importLoading ? '导入中...' : '确认导入'}
              </button>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportPrivateKey('');
                  setImportAccountName('');
                  setError('');
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mint BNB 模态框 */}
      {showMintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[999] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Mint 主网资产</h3>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  选择要Mint的地址
                </label>
                <select
                  value={selectedAddress}
                  onChange={(e) => setSelectedAddress(e.target.value)}
                  disabled={accountsLoading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                >
                  <option value="">{accountsLoading ? '加载中...' : '-- 选择账户 --'}</option>
                  {accounts.map((acc) => (
                    <option key={`${acc.type}-${acc.id}`} value={acc.address} className="text-gray-900">
                      {acc.account_name} ({acc.address.slice(0, 6)}...{acc.address.slice(-4)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  BNB 数量
                </label>
                <input
                  type="number"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  placeholder="输入BNB数量"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                {success}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleMintBNB}
                disabled={mintLoading}
                className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                {mintLoading ? '处理中...' : '确认Mint'}
              </button>
              <button
                onClick={() => {
                  setShowMintModal(false);
                  setMintAmount('');
                  setSelectedAddress('');
                  setError('');
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 包装WBNB 模态框 */}
      {showWrapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[999] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">包装 BNB 为 WBNB</h3>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  选择要包装的地址
                </label>
                <select
                  value={selectedAddress}
                  onChange={(e) => setSelectedAddress(e.target.value)}
                  disabled={accountsLoading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                >
                  <option value="">{accountsLoading ? '加载中...' : '-- 选择账户 --'}</option>
                  {accounts.map((acc) => (
                    <option key={`${acc.type}-${acc.id}`} value={acc.address} className="text-gray-900">
                      {acc.account_name} ({acc.address.slice(0, 6)}...{acc.address.slice(-4)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  BNB 数量
                </label>
                <input
                  type="number"
                  value={wrapAmount}
                  onChange={(e) => setWrapAmount(e.target.value)}
                  placeholder="输入BNB数量"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                {success}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleWrapWBNB}
                disabled={wrapLoading}
                className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
              >
                {wrapLoading ? '处理中...' : '确认包装'}
              </button>
              <button
                onClick={() => {
                  setShowWrapModal(false);
                  setWrapAmount('');
                  setSelectedAddress('');
                  setError('');
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <aside className="w-56 bg-white border-r border-gray-200 min-h-screen sticky top-16">
        <div className="p-6">
          {/* 配置选项 */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wider">配置选项</h3>
            <nav className="space-y-2">
              {configMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* 快速操作 */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wider">快速操作</h3>
            <nav className="space-y-2">
              {quickActions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleQuickAction(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* 错误和成功提示 */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {success}
            </div>
          )}
        </div>
      </aside>

      {/* 使用Portal将模态框渲染到document.body顶层 */}
      {typeof document !== 'undefined' && createPortal(modalContent, document.body)}
    </>
  );
};

export default Sidebar;