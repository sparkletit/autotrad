'use client';


import React, { useState, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import apiService from '@/lib/apiService';
import { useNetwork } from '@/lib/networkStore';
import UnifiedAddressSelector from '@/components/common/UnifiedAddressSelector';
import { fetchAllAccounts, fetchCustomTokens, fetchTokenBalances } from '@/lib/addressService';

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
  const net = useNetwork();
  const [allAccounts, setAllAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18 },
    { address: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18 },
    { address: '0xe9e7cea3dedca5984780bafc599bd69add087d56', symbol: 'BUSD', decimals: 18 },
  ]);
  const [newTokenDecimals, setNewTokenDecimals] = useState('18');
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(
    new Set()
  );
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [tokenSearchKeyword, setTokenSearchKeyword] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [queriedAddress, setQueriedAddress] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [savedRecords, setSavedRecords] = useState<any[]>([]);
  const [currentRecordLabel, setCurrentRecordLabel] = useState<string | null>(null);
  const [matchedRecords, setMatchedRecords] = useState<any[]>([]);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  const networks = [
    { id: 'fork', name: 'Fork 网络' },
    { id: 'ethereum', name: 'Ethereum' },
    { id: 'bsc', name: 'BSC' },
    { id: 'polygon', name: 'Polygon' },
  ];

  // 标记组件已挂载到客户端
  useEffect(() => {
    setIsClient(true);
    // 加载保存的记录
    loadSavedRecords();
  }, []);

  // 从localStorage加载保存的记录
  const loadSavedRecords = () => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('balance-checker-records');
        if (saved) {
          setSavedRecords(JSON.parse(saved));
        }
      } catch (err) {
        console.error('加载保存的记录失败:', err);
      }
    }
  };

  // 保存当前查询结果到localStorage
  const handleSaveRecord = () => {
    if (!saveLabel.trim()) {
      setError('请输入标签名称');
      return;
    }
    if (balances.length === 0) {
      setError('没有可保存的查询结果');
      return;
    }

    try {
        const record = {
          id: Date.now(),
          label: saveLabel.trim(),
          address: queriedAddress,
          network: net,
          balances: balances,
          timestamp: new Date().toISOString(),
        };

      const existingRecords = savedRecords || [];
      const updatedRecords = [...existingRecords, record];
      
      localStorage.setItem('balance-checker-records', JSON.stringify(updatedRecords));
      setSavedRecords(updatedRecords);
      setCurrentRecordLabel(saveLabel.trim());
      setShowSaveDialog(false);
      setSaveLabel('');
      setSuccess(`记录已保存为"${saveLabel.trim()}"`);
      
      // 更新匹配的记录
      const matched = updatedRecords.filter(
        (r) => r.address.toLowerCase() === queriedAddress.toLowerCase() && r.network === net
      );
      setMatchedRecords(matched);
    } catch (err) {
      setError('保存记录失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  // 清空所有保存的记录
  const handleClearRecords = () => {
    if (window.confirm('确定要清空所有保存的记录吗？此操作不可恢复。')) {
      try {
        localStorage.removeItem('balance-checker-records');
        setSavedRecords([]);
        setCurrentRecordLabel(null);
        setMatchedRecords([]);
        setSuccess('所有记录已清空');
      } catch (err) {
        setError('清空记录失败: ' + (err instanceof Error ? err.message : '未知错误'));
      }
    }
  };

  // 页面加载时从数据库读取自定义代币和账号

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 获取所有账户
        const accounts = await fetchAllAccounts();
        const accountOptions: AccountOption[] = accounts.map(acc => ({
          id: acc.id,
          type: acc.type,
          name: acc.account_name,
          address: acc.address,
        }));
        setAllAccounts(accountOptions);
        if (accountOptions.length > 0) {
          const firstAccountKey = `${accountOptions[0].type}-${accountOptions[0].id}`;
          setSelectedAccountId(firstAccountKey);
          setSearchAddress(accountOptions[0].address);
        }
      } catch (err) {
        console.error('加载账户失败:', err);
      }

      try {
        // 获取自定义代币
        const tokens = await fetchCustomTokens();
        setCustomTokens(tokens);
        const newSelected = new Set<string>();
        setSelectedTokens(newSelected);
      } catch (err) {
        console.error('加载自定义代币失败:', err);
      }
    };
    fetchData();
  }, []);



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
      const allTokenAddresses = new Set<string>(['BNB']);
      customTokens.forEach(token => {
        allTokenAddresses.add(token.address);
      });
      setSelectedTokens(allTokenAddresses);
    }
  };

  // 过滤代币根据搜索关键字
  const filteredCustomTokens = customTokens.filter((token) =>
    token.symbol.toLowerCase().includes(tokenSearchKeyword.toLowerCase()) ||
    token.address.toLowerCase().includes(tokenSearchKeyword.toLowerCase())
  );



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
      const { success, data, error } = await apiService.get(`/api/balance-checker?address=${searchAddress}&network=${net}&tokens=${encodeURIComponent(tokensJson)}`);

      if (success) {
        setBalances(((data as any)?.balances) || []);
        setQueriedAddress(((data as any)?.address));
        setCurrentRecordLabel(null); // 清除当前记录标签
        
        // 查找匹配的历史记录（相同地址和网络）
        const matched = savedRecords.filter((record) => record.address.toLowerCase() === String(((data as any)?.address || '')).toLowerCase() && record.network === net);
        setMatchedRecords(matched);
        
        setSuccess(`成功查询 ${((data as any)?.address)} 的余额`);
      } else {
        setError(error || '查询失败');
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

          <div className="grid grid-cols-1 gap-6">
            {/* 查询表单 */}
            <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
              {/* 网络选择已统一到 Header */}

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">账号选择</label>
                <UnifiedAddressSelector
                  value={searchAddress}
                  onChange={setSearchAddress}
                  placeholder="搜索或选择账号..."
                />
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
                        onChange={toggleAllTokens}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                      <label className="flex-1 cursor-pointer font-semibold text-sm text-gray-900" onClick={toggleAllTokens}>
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
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-600">查询的地址</p>
                      {currentRecordLabel && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                          标签: {currentRecordLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-mono text-gray-900 break-all">{queriedAddress}</p>
                  </div>

                  {/* 保存记录和清空记录按钮 */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSaveDialog(true)}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      保存记录
                    </button>
                    <button
                      onClick={handleClearRecords}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      清空记录
                    </button>
                    {savedRecords.length > 0 && (
                      <button
                        onClick={() => setShowHistoryDialog(true)}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        查看历史记录
                      </button>
                    )}
                  </div>

                  {/* 显示匹配的历史记录标签 */}
                  {matchedRecords.length > 0 && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm font-semibold text-yellow-900 mb-2">
                        找到 {matchedRecords.length} 条历史记录：
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {matchedRecords.map((record) => (
                          <span
                            key={record.id}
                            className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold"
                            title={`保存时间: ${new Date(record.timestamp).toLocaleString('zh-CN')}`}
                          >
                            {record.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

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
        </div>
      </div>

      {/* 保存记录对话框 */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">保存查询记录</h2>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                标签名称（支持中文）
              </label>
              <input
                type="text"
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveRecord();
                  }
                }}
                placeholder="例如：测试前余额、转账后余额等"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSaveRecord}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveLabel('');
                }}
                className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 历史记录对话框 */}
      {showHistoryDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-4">历史记录</h2>
            <div className="flex-1 overflow-y-auto">
              {savedRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无保存的记录
                </div>
              ) : (
                <div className="space-y-4">
                  {savedRecords
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((record) => (
                      <div
                        key={record.id}
                        className="p-4 border border-gray-300 text-xs text-gray-600 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                              {record.label}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(record.timestamp).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              if (window.confirm('确定要删除这条记录吗？')) {
                                const updated = savedRecords.filter((r) => r.id !== record.id);
                                setSavedRecords(updated);
                                localStorage.setItem('balance-checker-records', JSON.stringify(updated));
                                if (updated.length === 0) {
                                  setShowHistoryDialog(false);
                                }
                              }
                            }}
                            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                          >
                            删除
                          </button>
                        </div>
                        <div className="text-xs text-gray-600 mb-2">
                          <span className="font-semibold">地址:</span>{' '}
                          <span className="font-mono">{record.address}</span>
                          {' | '}
                          <span className="font-semibold">网络:</span> {record.network}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-2 py-1 text-left">代币</th>
                                <th className="px-2 py-1 text-right">余额</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {record.balances.map((balance: TokenBalance) => (
                                <tr key={balance.symbol}>
                                  <td className="px-2 py-1">
                                    <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                      {balance.symbol}
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 text-right font-mono font-semibold">
                                    {balance.formatted}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowHistoryDialog(false)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold rounded-lg transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
