'use client';


import React, { useState, useRef, useEffect } from 'react';
import Header from '@/components/Header';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  formatted: string;
  decimals: number;
  contractAddress: string | null;
}

interface CustomToken {
  id?: number;
  address: string;
  symbol: string;
  decimals: number;
}

interface MainAccount {
  id: number;
  accountName: string;
  address: string;
  publicKey: string;
  createTime: string;
}

interface DerivedAccount {
  id: number;
  mainAccountId: number;
  accountName: string;
  address: string;
  publicKey: string;
  derivationIndex: number;
  createTime: string;
}

interface AccountOption {
  id: number;
  type: 'main' | 'derived';
  mainAccountId?: number;
  name: string;
  address: string;
}

export default function BalanceCheckerClient() {
  const [searchAddress, setSearchAddress] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('fork');
  const [allAccounts, setAllAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18 },
    { address: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18 },
    { address: '0xe9e7cea3dedca5984780bafc599bd69add087d56', symbol: 'BUSD', decimals: 18 },
  ]);
  const [newTokenAddress, setNewTokenAddress] = useState('');
  const [newTokenSymbol, setNewTokenSymbol] = useState('');
  const [newTokenDecimals, setNewTokenDecimals] = useState('18');
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(
    new Set(['BNB', ...customTokens.map((t) => t.address)])
  );
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [tokenSearchKeyword, setTokenSearchKeyword] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [queriedAddress, setQueriedAddress] = useState('');
  const [isClient, setIsClient] = useState(false);

  const networks = [
    { id: 'fork', name: 'Fork 网络' },
    { id: 'ethereum', name: 'Ethereum' },
    { id: 'bsc', name: 'BSC' },
    { id: 'polygon', name: 'Polygon' },
  ];

  // 标记组件已挂载到客户端
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 页面加载时从数据库读取自定义代币和账号

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 获取主账号
        const accountsResponse = await fetch('/api/address-books/main-accounts');
        const accountsData = await accountsResponse.json();
        if (accountsData.success && accountsData.data) {
          const accounts: AccountOption[] = [];
          
          // 添加主账号
          for (const mainAccount of accountsData.data) {
            accounts.push({
              id: mainAccount.id,
              type: 'main',
              name: mainAccount.account_name,
              address: mainAccount.address,
            });
            
            // 获取该主账号的派生账号
            try {
              const derivedResponse = await fetch(`/api/address-books/main-accounts/${mainAccount.id}/derived-accounts`);
              const derivedData = await derivedResponse.json();
              if (derivedData.success && derivedData.data) {
                for (const derivedAccount of derivedData.data) {
                  accounts.push({
                    id: derivedAccount.id,
                    type: 'derived',
                    mainAccountId: mainAccount.id,
                    name: `${derivedAccount.account_name} (from ${mainAccount.account_name})`,
                    address: derivedAccount.address,
                  });
                }
              }
            } catch (err) {
              console.error(`加载主账号${mainAccount.id}的派生账号失败:`, err);
            }
          }
          
          setAllAccounts(accounts);
          if (accounts.length > 0) {
            const firstAccountKey = `${accounts[0].type}-${accounts[0].id}`;
            setSelectedAccountId(firstAccountKey);
            setSearchAddress(accounts[0].address);
          }
        }
      } catch (err) {
        console.error('加载主账号失败:', err);
      }

      try {
        // 获取自定义代币
        const response = await fetch('/api/custom-tokens');
        const data = await response.json();
        if (data.success) {
          setCustomTokens(data.data || []);
          // 重新初始化选中代币
          const newSelected = new Set(['BNB']);
          data.data.forEach((token: CustomToken) => {
            newSelected.add(token.address);
          });
          setSelectedTokens(newSelected);
        }
      } catch (err) {
        console.error('加载自定义代币失败:', err);
      }
    };
    fetchData();
  }, []);

  // 处理账号选择变化
  const handleAccountSelect = (accountKey: string) => {
    const [type, idStr] = accountKey.split('-');
    const accountId = parseInt(idStr);
    const selected = allAccounts.find(acc => acc.id === accountId && acc.type === (type as 'main' | 'derived'));
    if (selected) {
      setSelectedAccountId(accountKey);
      setSearchAddress(selected.address);
    }
  };

  // 关闭token下拉框的外部点击处理
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTokenDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddCustomToken = () => {
    if (!newTokenAddress.trim() || !newTokenSymbol.trim()) {
      setError('请输入代币地址和符号');
      return;
    }

    const decimals = parseInt(newTokenDecimals) || 18;
    if (decimals < 0 || decimals > 255) {
      setError('精度必须在0-255之间');
      return;
    }

    if (!newTokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('无效的代币地址格式');
      return;
    }

    if (customTokens.some((t) => t.address.toLowerCase() === newTokenAddress.toLowerCase())) {
      setError('该代币地址已添加');
      return;
    }

    // 添加到数据库
    const addTokenToDb = async () => {
      try {
        setError('');
        const response = await fetch('/api/custom-tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: newTokenSymbol.toUpperCase(),
            address: newTokenAddress,
            decimals,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || `添加失败 (HTTP ${response.status})`);
          console.error('添加代币错误:', response.status, errorData);
          return;
        }
        
        const data = await response.json();
        console.log('添加代币响应:', data);
        
        if (data.success) {
          const newToken = data.data;
          setCustomTokens([...customTokens, newToken]);
          setSelectedTokens(new Set([...selectedTokens, newTokenAddress]));
          setNewTokenAddress('');
          setNewTokenSymbol('');
          setNewTokenDecimals('18');
          setSuccess('代币添加成功');
          setTimeout(() => setSuccess(''), 2000);
        } else {
          setError(data.error || '添加失败');
        }
      } catch (err) {
        console.error('添加代币异常:', err);
        setError(err instanceof Error ? err.message : '添加代币失败');
      }
    };
    addTokenToDb();
  };

  const handleTokenToggle = (address: string) => {
    // BNB不能取消选择
    if (address === 'BNB') {
      return;
    }
    const newSelected = new Set(selectedTokens);
    if (newSelected.has(address)) {
      newSelected.delete(address);
    } else {
      newSelected.add(address);
    }
    setSelectedTokens(newSelected);
  };

  const toggleAllTokens = () => {
    if (selectedTokens.size === customTokens.length + 1) {
      // 全选状态，取消其他（保留BNB）
      setSelectedTokens(new Set(['BNB']));
    } else {
      // 未全选，全选所有代币（包括BNB）
      setSelectedTokens(new Set(['BNB', ...customTokens.map((t) => t.address)]));
    }
  };

  // 过滤代币根据搜索关键字
  const filteredCustomTokens = customTokens.filter((token) =>
    token.symbol.toLowerCase().includes(tokenSearchKeyword.toLowerCase()) ||
    token.address.toLowerCase().includes(tokenSearchKeyword.toLowerCase())
  );

  const handleRemoveCustomToken = (address: string) => {
    const tokenToDelete = customTokens.find((t) => t.address.toLowerCase() === address.toLowerCase());
    if (!tokenToDelete?.id) return;

    // 从数据库删除
    const deleteFromDb = async () => {
      try {
        setError('');
        const response = await fetch(`/api/custom-tokens/${tokenToDelete.id}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || `删除失败 (HTTP ${response.status})`);
          console.error('删除代币错误:', response.status, errorData);
          return;
        }
        
        const data = await response.json();
        console.log('删除代币响应:', data);
        
        if (data.success) {
          setCustomTokens(customTokens.filter((t) => t.address.toLowerCase() !== address.toLowerCase()));
          const newSelected = new Set(selectedTokens);
          newSelected.delete(address);
          setSelectedTokens(newSelected);
          setSuccess('代币删除成功');
          setTimeout(() => setSuccess(''), 2000);
        } else {
          setError(data.error || '删除失败');
        }
      } catch (err) {
        console.error('删除代币异常:', err);
        setError(err instanceof Error ? err.message : '删除代币失败');
      }
    };
    deleteFromDb();
  };

  const handleSearch = async () => {
    if (!searchAddress.trim()) {
      setError('请输入有效的钱包地址');
      return;
    }

    if (!searchAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('无效的以太坊地址格式（应以0x开头，长度为42）');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setBalances([]);

      // 只查询选中的代币（排除BNB，BNB由API单独处理）
      const tokensToQuery = customTokens.filter((t) => selectedTokens.has(t.address));
      const tokensJson = JSON.stringify(tokensToQuery);
      const response = await fetch(
        `/api/balance-checker?address=${searchAddress}&network=${selectedNetwork}&tokens=${encodeURIComponent(tokensJson)}`
      );
      const data = await response.json();

      if (data.success) {
        setBalances(data.data.balances || []);
        setQueriedAddress(data.data.address);
        setSuccess(`成功查询 ${data.data.address} 的余额`);
      } else {
        setError(data.error || '查询失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const selectedTokenList = customTokens.filter((t) => selectedTokens.has(t.address));

  return (
    <>
      <Header title="余额查询" />
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">余额查询器</h1>
            <p className="text-gray-600">输入钱包地址查询其在各个网络上的代币余额</p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* 左侧：查询表单 */}
            <div className="col-span-2">
              <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">选择网络</label>
                  <select
                    value={selectedNetwork}
                    onChange={(e) => setSelectedNetwork(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {networks.map((net) => (
                      <option key={net.id} value={net.id}>
                        {net.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">账号选择</label>
                  <select
                    value={selectedAccountId || ''}
                    onChange={(e) => handleAccountSelect(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    
                    <option value="">– 选择账号 –</option>
                    {allAccounts.map((account) => (
                      console.log(account),
                      <option key={`${account.type}-${account.id}`} value={`${account.type}-${account.id}`}>
                        {account.name} - ({account.address})
                      </option>
                    ))}
                  </select>
                  {allAccounts.length === 0 && (
                    <p className="text-xs text-gray-500 mt-2">没有可用账号，请先到地址本管理添加</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">钱包地址</label>
                  <input
                    type="text"
                    value={searchAddress}
                    onChange={(e) => setSearchAddress(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="输入钱包地址（以0x开头）"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                  >
                    {loading ? '查询中...' : '查询余额'}
                  </button>
                </div>

                {/* 多选下拉框 */}
                <div ref={dropdownRef} className="relative">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    需要查询的代币 ({selectedTokens.size}/{customTokens.length + 1})
                  </label>
                  <button
                    onClick={() => setShowTokenDropdown(!showTokenDropdown)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm">
                      BNB{selectedTokenList.length > 0 ? ', ' + selectedTokenList.map((t) => t.symbol).join(', ') : ''}
                    </span>
                    <svg
                      className={`w-5 h-5 transition-transform ${showTokenDropdown ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>

                  {/* 下拉菜单 */}
                  {showTokenDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-w-md">
                      {/* 搜索框 */}
                      <div className="px-4 py-3 border-b border-gray-200 sticky top-0 bg-white">
                        <input
                          type="text"
                          value={tokenSearchKeyword}
                          onChange={(e) => setTokenSearchKeyword(e.target.value)}
                          placeholder="搜索代币符号或地址..."
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* 全选选项 */}
                      <div className="px-4 py-2 border-b border-gray-200 hover:bg-gray-50 flex items-center gap-3 cursor-pointer" onClick={toggleAllTokens}>
                        <input
                          type="checkbox"
                          checked={selectedTokens.size === customTokens.length + 1}
                          onChange={() => {}}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                        <label className="flex-1 cursor-pointer font-semibold text-sm text-gray-900">
                          {selectedTokens.size === customTokens.length + 1 ? '取消全选' : '全选'}
                        </label>
                      </div>

                      {/* BNB - 始终显示，无法取消选择 */}
                      <div className="px-4 py-3 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-100">
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => {}}
                          className="w-4 h-4 rounded cursor-not-allowed"
                          disabled
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">BNB</p>
                          <p className="text-xs text-gray-600">原生资产（始终选中）</p>
                        </div>
                      </div>

                      {/* 代币列表 */}
                      <div className="max-h-64 overflow-y-auto">
                        {filteredCustomTokens.length === 0 ? (
                          <div className="px-4 py-6 text-center text-gray-500 text-sm">
                            {tokenSearchKeyword ? '没有找到匹配的代币' : '暂无自定义代币'}
                          </div>
                        ) : (
                          filteredCustomTokens.map((token) => (
                            <div
                              key={token.address}
                              className="px-4 py-3 hover:bg-blue-50 flex items-center gap-3 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={() => handleTokenToggle(token.address)}
                            >
                              <input
                                type="checkbox"
                                checked={selectedTokens.has(token.address)}
                                onChange={() => {}}
                                className="w-4 h-4 rounded cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900">{token.symbol}</p>
                                <p className="text-xs text-gray-600">decimals: {token.decimals}</p>
                                <p className="text-xs text-gray-500 font-mono break-all">{token.address}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">{success}</p>
                  </div>
                )}

                {balances.length > 0 && (
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">查询的地址</p>
                      <p className="text-sm font-mono text-gray-900 break-all">{queriedAddress}</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">代币</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">名称</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-700">余额</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-700">合约地址</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {balances.map((balance) => (
                            <tr key={balance.symbol} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                  {balance.symbol}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-900">{balance.name}</td>
                              <td className="px-4 py-3 text-right text-gray-900 font-mono font-semibold">
                                {balance.formatted}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {balance.contractAddress ? (
                                  <span className="font-mono text-xs break-all text-gray-500">{balance.contractAddress}</span>
                                ) : (
                                  <span className="text-gray-400">原生资产</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!loading && balances.length === 0 && !error && (
                  <div className="p-6 bg-gray-50 border border-gray-300 rounded-lg text-center">
                    <p className="text-gray-600">输入地址并点击"查询余额"来查看代币余额</p>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧：自定义代币管理 */}
            <div className="space-y-6">
              {/* 添加代币卡片 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">添加代币</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">合约地址</label>
                    <input
                      type="text"
                      value={newTokenAddress}
                      onChange={(e) => setNewTokenAddress(e.target.value)}
                      placeholder="0x开头的地址"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">代币符号</label>
                    <input
                      type="text"
                      value={newTokenSymbol}
                      onChange={(e) => setNewTokenSymbol(e.target.value)}
                      placeholder="如 USDT"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">精度 (decimals)</label>
                    <input
                      type="number"
                      value={newTokenDecimals}
                      onChange={(e) => setNewTokenDecimals(e.target.value)}
                      min="0"
                      max="255"
                      placeholder="18"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">默认值: 18</p>
                  </div>

                  <button
                    onClick={handleAddCustomToken}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    添加代币
                  </button>
                </div>
              </div>

              {/* 已添加代币卡片 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">已添加代币 ({customTokens.length})</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {customTokens.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center py-4">暂无已添加的代币</p>
                  ) : (
                    customTokens.map((token) => (
                      <div
                        key={token.address}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedTokens.has(token.address)
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                        onClick={() => handleTokenToggle(token.address)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedTokens.has(token.address)}
                              onChange={() => {}}
                              className="w-4 h-4 rounded flex-shrink-0 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                  {token.symbol}
                                </span>
                                <span className="text-xs text-gray-600">decimals: {token.decimals}</span>
                              </div>
                              <p className="text-xs text-gray-600 font-mono break-all mt-1">{token.address}</p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCustomToken(token.address);
                            }}
                            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors text-xs font-semibold flex-shrink-0"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 说明卡片 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">说明</h3>
                <div className="space-y-3 text-sm text-gray-700">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">BNB资产</h4>
                    <p className="text-xs text-gray-600">
                      BNB（原生资产）将始终被查询，无法取消选择
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">搜索功能</h4>
                    <p className="text-xs text-gray-600">
                      在下拉框中输入代币符号或合约地址来快速查找代币
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">精度 (decimals)</h4>
                    <p className="text-xs text-gray-600">
                      大多数代币使用18位精度，少数为其他值（如USDC某些链为6）
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
