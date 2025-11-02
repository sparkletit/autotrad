'use client';

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';

interface ChainInfo {
  chainId: number;
  chainName: string;
  blockNumber: string;
}

interface Account {
  id: number;
  account_name: string;
  address: string;
  type: 'main' | 'derived';
}

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  formatted: string;
  decimals: number;
  contractAddress: string | null;
}

interface AddressEntry {
  id: number;
  alias: string;
  address: string;
}

const TradePage: React.FC = () => {
  const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [addressAliases, setAddressAliases] = useState<AddressEntry[]>([]);
  
  const [fromAddress, setFromAddress] = useState('');
  const [customTokens, setCustomTokens] = useState<Array<{ symbol: string; address: string; decimals?: number }>>([]);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState('BNB');
  const [selectedNetwork, setSelectedNetwork] = useState('fork');
  const [tokenSearchKeyword, setTokenSearchKeyword] = useState('');
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [txHash, setTxHash] = useState('');
  const tokenDropdownRef = useRef<HTMLDivElement>(null);

  const networks = [
    { id: 'fork', name: 'Fork 网络', rpc: 'http://host.docker.internal:8545' },
    { id: 'ethereum', name: 'Ethereum', rpc: 'https://mainnet.infura.io/v3/YOUR_KEY' },
    { id: 'bsc', name: 'BSC', rpc: 'https://bsc-dataseed1.bnbchain.org' },
    { id: 'polygon', name: 'Polygon', rpc: 'https://polygon-rpc.com' },
  ];

  // 过滤代币根据搜索关键字
  const filteredTokens = [
    { symbol: 'BNB', address: null },
    ...customTokens.map(token => ({
      symbol: token.symbol,
      address: token.address,
    })),
  ].filter((token) =>
    token.symbol.toLowerCase().includes(tokenSearchKeyword.toLowerCase())
  );

  useEffect(() => {
    document.title = '交易 - Web3 交易平台';
    fetchChainInfo();
    const interval = setInterval(fetchChainInfo, 5000);
    return () => clearInterval(interval);
  }, [selectedNetwork]);

  // 从数据库加载自定义代币
  useEffect(() => {
    const fetchCustomTokens = async () => {
      try {
        const response = await fetch('/api/custom-tokens');
        const data = await response.json();
        if (data.success) {
          setCustomTokens(data.data.map((t: any) => ({
            symbol: t.symbol,
            address: t.contract_address || t.address,
            decimals: t.decimals || 18,
          })));
        }
      } catch (err) {
        console.error('加载自定义代币失败:', err);
      }
    };
    fetchCustomTokens();
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchAddressAliases();
  }, []);

  useEffect(() => {
    if (fromAddress) {
      fetchTokenBalances(fromAddress);
      setSelectedToken('BNB');
    }
  }, [fromAddress]);

  // 关闭代币下拉框的外部点击处理
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setShowTokenDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchChainInfo = async () => {
    try {
      setChainLoading(true);
      const response = await fetch(`/api/fork/chain-info?network=${selectedNetwork}`);
      const data = await response.json();
      if (data.success) {
        setChainInfo(data.data);
      }
    } catch (err) {
      console.error('获取链信息失败:', err);
    } finally {
      setChainLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts/all');
      const data = await response.json();
      if (data.success) {
        setAccounts(data.data || []);
      }
    } catch (err) {
      console.error('获取账户列表失败:', err);
    }
  };

  const fetchAddressAliases = async () => {
    try {
      const response = await fetch('/api/address-aliases');
      const data = await response.json();
      if (data.success) {
        setAddressAliases(
          data.data.map((item: any) => ({
            id: item.id,
            alias: item.alias,
            address: item.address,
          }))
        );
      }
    } catch (err) {
      console.error('获取地址别名失败:', err);
    }
  };

  const fetchTokenBalances = async (address: string) => {
    try {
      setBalancesLoading(true);
      const response = await fetch(`/api/accounts/${address}/balances`);
      const data = await response.json();
      if (data.success) {
        setTokenBalances(data.data || []);
      } else {
        setTokenBalances([]);
      }
    } catch (err) {
      console.error('获取代币余额失败:', err);
      setTokenBalances([]);
    } finally {
      setBalancesLoading(false);
    }
  };

  const getSelectedTokenBalance = (): TokenBalance | undefined => {
    // 首先从 tokenBalances 中查找（API 返回的已知代币）
    const found = tokenBalances.find((t) => t.symbol === selectedToken);
    if (found) return found;
    
    // 如果是自定义代币，构造一个虚拟的 TokenBalance 对象
    const customToken = customTokens.find((t) => t.symbol === selectedToken);
    if (customToken) {
      return {
        symbol: customToken.symbol,
        name: customToken.symbol,
        balance: '0',
        formatted: '0',
        decimals: customToken.decimals || 18,
        contractAddress: customToken.address,
      };
    }
    
    return undefined;
  };

  const getReceivingAddressOptions = () => {
    const options = [];
    let optionIndex = 0;
    
    // 添加账户
    for (const account of accounts) {
      options.push({
        type: 'account',
        id: account.id,
        label: `${account.account_name} (${account.address})`,
        value: account.address,
        uniqueKey: `account-${optionIndex}`,
      });
      optionIndex++;
    }
    
    // 添加地址别名
    for (const alias of addressAliases) {
      options.push({
        type: 'alias',
        id: alias.id,
        label: `${alias.alias} (${alias.address})`,
        value: alias.address,
        uniqueKey: `alias-${optionIndex}`,
      });
      optionIndex++;
    }
    
    return options;
  };

  const handleTransfer = async () => {
    if (!fromAddress || !toAddress || !amount) {
      setError('请填写所有必要字段');
      return;
    }

    if (parseFloat(amount) <= 0) {
      setError('转账数量必须大于0');
      return;
    }

    const selectedTokenBalance = getSelectedTokenBalance();
    if (!selectedTokenBalance) {
      setError(`无法识别代币: ${selectedToken}`);
      return;
    }

    // 对于 BNB，检查余额
    if (selectedToken === 'BNB') {
      if (parseFloat(selectedTokenBalance.formatted || '0') <= 0) {
        setError('BNB余额不足');
        return;
      }
      if (parseFloat(amount) > parseFloat(selectedTokenBalance.formatted || '0')) {
        setError(`BNB余额不足。可用余额: ${selectedTokenBalance.formatted} BNB`);
        return;
      }
    }
    // 对于自定义代币，跳过余额检查（因为无法从 API 获取准确的自定义代币余额）
    // 但仍然尝试执行转账，失败时由后端返回错误
    else {
      // 自定义代币只做基本验证
      console.log(`准备转账自定义代币: ${selectedToken} (${selectedTokenBalance.contractAddress})`);
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setTxHash('');

      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress,
          toAddress,
          amount,
          tokenAddress: selectedTokenBalance?.contractAddress || null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
        setTxHash(data.txHash);
        setToAddress('');
        setAmount('');
        await fetchTokenBalances(fromAddress);
      } else {
        setError(data.error || '转账失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '转账失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectToken = (symbol: string) => {
    setSelectedToken(symbol);
    setShowTokenDropdown(false);
    setTokenSearchKeyword('');
  };

  return (
    <>
      <Header title="交易" />
      <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 页面标题和链信息 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">代币转账</h1>

          {/* 链信息卡片 */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="grid grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">网络</p>
                <p className="text-xl font-bold text-gray-900">
                  {chainInfo?.chainName || '加载中...'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Chain ID</p>
                <p className="text-xl font-bold text-gray-900">
                  {chainInfo?.chainId || '加载中...'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">当前区块</p>
                <p className="text-xl font-bold text-gray-900">
                  {chainInfo?.blockNumber || '加载中...'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">选择网络</p>
                <select
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {networks.map((net) => (
                    <option key={net.id} value={net.id}>
                      {net.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* 左侧：转账表单 */}
          <div className="col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
              <h2 className="text-xl font-bold text-gray-900">转账信息</h2>

              {/* 错误提示 */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* 成功提示 */}
              {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                  <p className="text-sm text-green-800">{success}</p>
                  {txHash && (
                    <p className="text-xs text-green-700 font-mono break-all">
                      交易哈希: {txHash}
                    </p>
                  )}
                </div>
              )}

              {/* 发送方 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  发送方账户 *
                </label>
                <select
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                >
                  <option value="">-- 选择发送方账户 --</option>
                  {accounts.map((account) => (
                    <option key={`${account.type}-${account.id}`} value={account.address}>
                      {account.account_name} ({account.address})
                    </option>
                  ))}
                </select>

                {/* 显示选中账户的多种代币余额 */}
                {fromAddress && (
                  <div className="space-y-2">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-600 mb-1">账户地址</p>
                      <p className="text-sm font-mono text-blue-900 break-all">{fromAddress}</p>
                    </div>


                  </div>
                )}
              </div>

              {/* 代币选择 - 可搜索下拉框 */}
              <div ref={tokenDropdownRef} className="relative">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  转账代币 *
                </label>
                <button
                  onClick={() => setShowTokenDropdown(!showTokenDropdown)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span>{selectedToken}</span>
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
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                    {/* 搜索框 */}
                    <div className="p-3 border-b border-gray-200 sticky top-0 bg-white">
                      <input
                        type="text"
                        value={tokenSearchKeyword}
                        onChange={(e) => setTokenSearchKeyword(e.target.value)}
                        placeholder="搜索代币符号..."
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* 代币列表 */}
                    <div className="max-h-64 overflow-y-auto">
                      {filteredTokens.length === 0 ? (
                        <div className="px-4 py-6 text-center text-gray-500 text-sm">
                          没有找到匹配的代币
                        </div>
                      ) : (
                        filteredTokens.map((token) => {
                          const balance = tokenBalances.find((t) => t.symbol === token.symbol);
                          const isCustomToken = token.symbol !== 'BNB' && !['USDT', 'USDC', 'BUSD'].includes(token.symbol);
                          return (
                            <button
                              key={token.symbol}
                              onClick={() => handleSelectToken(token.symbol)}
                              className={`w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                                selectedToken === token.symbol ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">{token.symbol}</span>
                                  {isCustomToken && (
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">自定义</span>
                                  )}
                                </div>
                                <span className="text-sm text-gray-600">
                                  {balance ? `余额: ${balance.formatted}` : isCustomToken ? '自定义代币' : '余额: 0'}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 接收方 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  接收方账户 *
                </label>
                <select
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                >
                  <option value="">-- 选择或输入接收方 --</option>
                  {getReceivingAddressOptions().map((option) => (
                    <option key={option.uniqueKey} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {/* 自定义地址输入 */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="或输入钱包地址（0x开头）"
                    value={toAddress}
                    onChange={(e) => setToAddress(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 转账数量 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  转账数量 ({selectedToken}) *
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="输入转账数量"
                  step="0.0001"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 转账按钮 */}
              <button
                onClick={handleTransfer}
                disabled={loading || !fromAddress || !toAddress || !amount}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? '转账中...' : '确认转账'}
              </button>
            </div>
          </div>

          {/* 右侧：说明和网络状态 */}
          <div className="space-y-6">
            {/* 说明卡片 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">使用说明</h3>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex gap-3">
                  <span className="text-blue-500 font-bold">1</span>
                  <p>选择转账网络</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-500 font-bold">2</span>
                  <p>选择发送方账户</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-500 font-bold">3</span>
                  <p>选择转账代币（支持搜索）</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-500 font-bold">4</span>
                  <p>选择或输入接收方地址</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-500 font-bold">5</span>
                  <p>输入转账数量</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-500 font-bold">6</span>
                  <p>点击"确认转账"执行转账</p>
                </div>
              </div>
            </div>

            {/* 网络状态 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">网络状态</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">当前网络:</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                    {networks.find((n) => n.id === selectedNetwork)?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">自动更新:</span>
                  <span className="text-xs text-gray-600">每5秒一次</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default TradePage;
