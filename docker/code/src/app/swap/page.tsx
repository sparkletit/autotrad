import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';

interface Account {
  id: number;
  account_name: string;
  address: string;
  type: 'main' | 'derived';
}

interface TokenBalance {
  symbol: string;
  balance: string;
  formatted: string;
  decimals: number;
  contractAddress: string | null;
}

interface CustomToken {
  symbol: string;
  address: string;
  decimals: number;
}

interface PairReserves {
  reserve0: string;
  reserve1: string;
  blockTimestampLast: number;
  token0: string;
  token1: string;
}

const SwapPage: React.FC = () => {
  // 基础状态
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([]);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [fromAddress, setFromAddress] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('fork');

  // 第一步：交易池地址
  const [pairAddress, setPairAddress] = useState('');
  const [pairReserves, setPairReserves] = useState<PairReserves | null>(null);
  const [loadingReserves, setLoadingReserves] = useState(false);

  // 第二步：Gas 和滑点
  const [gasMode, setGasMode] = useState<'auto' | '500000' | '1000000'>('auto');
  const [customGas, setCustomGas] = useState('');
  const [slippageMode, setSlippageMode] = useState<'auto' | '0.5' | '5' | '10' | '30'>('0.5');
  const [customSlippage, setCustomSlippage] = useState('');

  // 第三步：代币选择
  const [selectedTokenIn, setSelectedTokenIn] = useState('');
  const [selectedTokenOut, setSelectedTokenOut] = useState('');
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');

  // 状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [txHash, setTxHash] = useState('');

  // 快速操作
  const [showWrapModal, setShowWrapModal] = useState(false);
  const [showAddTokenModal, setShowAddTokenModal] = useState(false);
  const [wrapAmount, setWrapAmount] = useState('');
  const [newTokenSymbol, setNewTokenSymbol] = useState('');
  const [newTokenAddress, setNewTokenAddress] = useState('');
  const [newTokenDecimals, setNewTokenDecimals] = useState('18');

  const isPairAddressValid = pairAddress.match(/^0x[a-fA-F0-9]{40}$/);
  
  const allTokens = [
    { symbol: 'BNB', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
    { symbol: 'WBNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18 },
    ...customTokens,
  ];

  // 去除重复的代币（根据地址）
  const uniqueTokens = allTokens.reduce((acc, token) => {
    const exists = acc.find(t => t.address.toLowerCase() === token.address.toLowerCase());
    if (!exists) {
      acc.push(token);
    }
    return acc;
  }, [] as typeof allTokens);

  // 获取实际的 gas limit
  const getGasLimit = () => {
    if (gasMode === 'auto') return 'auto';
    if (gasMode === '500000') return '500000';
    if (gasMode === '1000000') return '1000000';
    return customGas || 'auto';
  };

  // 获取实际的滑点
  const getSlippage = () => {
    if (slippageMode === 'auto') return 'auto';
    if (slippageMode === '0.5') return '0.5';
    if (slippageMode === '5') return '5';
    if (slippageMode === '10') return '10';
    if (slippageMode === '30') return '30';
    return customSlippage || '0.5';
  };

  useEffect(() => {
    fetchAccounts();
    fetchCustomTokens();
  }, []);

  useEffect(() => {
    if (fromAddress) {
      fetchTokenBalances(fromAddress);
    }
  }, [fromAddress]);

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

  const fetchCustomTokens = async () => {
    try {
      const response = await fetch('/api/custom-tokens');
      const data = await response.json();
      if (data.success) {
        setCustomTokens(data.data.map((t: any) => ({
          symbol: t.symbol,
          address: t.address,
          decimals: t.decimals,
        })));
      }
    } catch (err) {
      console.error('加载自定义代币失败:', err);
    }
  };

  const fetchTokenBalances = async (address: string) => {
    try {
      const response = await fetch(`/api/accounts/${address}/balances`);
      const data = await response.json();
      if (data.success) {
        setTokenBalances(data.data || []);
      }
    } catch (err) {
      console.error('获取代币余额失败:', err);
    }
  };

  // 查询交易池储备
  const handleQueryReserves = async () => {
    if (!isPairAddressValid) {
      setError('请输入有效的交易池地址');
      return;
    }

    try {
      setLoadingReserves(true);
      setError('');
      
      const response = await fetch('/api/swap/get-reserves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairAddress,
          network: selectedNetwork,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setPairReserves(data.data);
        setSuccess('储备查询成功');
        setTimeout(() => setSuccess(''), 2000);
      } else {
        setError(data.error || '查询储备失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询储备失败');
    } finally {
      setLoadingReserves(false);
    }
  };

  // 点击包装WBNB按钮
  const handleClickWrapBNBButton = () => {
    if (!fromAddress) {
      setError('请先选择账户');
      return;
    }
    setShowWrapModal(true);
    setError('');
  };

  // 执行包装WBNB
  const handleExecuteWrapBNB = async () => {
    if (!wrapAmount || parseFloat(wrapAmount) <= 0) {
      setError('请输入有效的BNB数量');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setTxHash('');

      const response = await fetch('/api/swap/wrap-wbnb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: fromAddress,
          amount: wrapAmount,
          network: selectedNetwork,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功将 ${wrapAmount} BNB 包装为 WBNB`);
        setTxHash(data.data.txHash);
        setWrapAmount('');
        setShowWrapModal(false);
        setTimeout(() => {
          if (fromAddress) fetchTokenBalances(fromAddress);
        }, 1000);
      } else {
        setError(data.error || '包装失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '包装失败');
    } finally {
      setLoading(false);
    }
  };

  // 添加代币到数据库
  const handleAddTokenToDatabase = async () => {
    if (!newTokenSymbol.trim()) {
      setError('请输入代币符号');
      return;
    }
    if (!newTokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('请输入有效的代币地址');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/custom-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: newTokenSymbol.toUpperCase(),
          address: newTokenAddress,
          decimals: parseInt(newTokenDecimals),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(`成功添加代币 ${newTokenSymbol.toUpperCase()}`);
        setNewTokenSymbol('');
        setNewTokenAddress('');
        setNewTokenDecimals('18');
        setShowAddTokenModal(false);
        fetchCustomTokens();
      } else {
        setError(data.error || '添加失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setLoading(false);
    }
  };

  // 执行 Swap
  const handleSwap = async () => {
    if (!fromAddress) {
      setError('请先选择账户');
      return;
    }
    if (!isPairAddressValid) {
      setError('请输入有效的交易池地址');
      return;
    }
    if (!selectedTokenIn || !selectedTokenOut) {
      setError('请选择输入和输出代币');
      return;
    }
    if (!amountIn || parseFloat(amountIn) <= 0) {
      setError('请输入有效的交换数量');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setTxHash('');

      const response = await fetch('/api/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: fromAddress,
          pairAddress,
          tokenIn: selectedTokenIn,
          tokenOut: selectedTokenOut,
          amountIn,
          gasLimit: getGasLimit(),
          slippage: getSlippage(),
          network: selectedNetwork,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('交换成功');
        setTxHash(data.data.txHash);
        setAmountIn('');
        setAmountOut(data.data.amountOut || '');
        setTimeout(() => {
          if (fromAddress) fetchTokenBalances(fromAddress);
        }, 1000);
      } else {
        setError(data.error || '交换失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '交换失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="交换" />
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">代币交换</h1>

          <div className="grid grid-cols-3 gap-6">
            {/* 左侧：主要功能 */}
            <div className="col-span-2 space-y-6">
              {/* 账户选择 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">账户信息</h2>
                {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4"><p className="text-sm text-red-800">{error}</p></div>}
                {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4"><p className="text-sm text-green-800">{success}</p>{txHash && <p className="text-xs text-green-700 font-mono mt-2 break-all">TX: {txHash}</p>}</div>}
                <select value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- 选择账户 --</option>
                  {accounts.map((account) => (
                    <option key={`${account.type}-${account.id}`} value={account.address}>
                      {account.account_name} ({account.address.slice(0, 6)}...{account.address.slice(-4)})
                    </option>
                  ))}
                </select>
              </div>

              {/* 第一步：交易池地址 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">第一步：交易池地址</h2>
                <div className="flex gap-3">
                  <input type="text" value={pairAddress} onChange={(e) => setPairAddress(e.target.value)} placeholder="输入 Pair 合约地址 (0x...)" className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={handleQueryReserves} disabled={loadingReserves || !isPairAddressValid} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors">
                    {loadingReserves ? '查询中...' : '查询储备'}
                  </button>
                </div>
                {pairReserves && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-semibold text-blue-900 mb-2">储备信息：</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-blue-600">Token0:</span> <span className="font-mono text-blue-900">{pairReserves.token0}</span></div>
                      <div><span className="text-blue-600">Reserve0:</span> <span className="font-mono text-blue-900">{pairReserves.reserve0}</span></div>
                      <div><span className="text-blue-600">Token1:</span> <span className="font-mono text-blue-900">{pairReserves.token1}</span></div>
                      <div><span className="text-blue-600">Reserve1:</span> <span className="font-mono text-blue-900">{pairReserves.reserve1}</span></div>
                    </div>
                  </div>
                )}
              </div>

              {/* 第二步：Gas 和滑点 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">第二步：Gas 和滑点设置</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Gas Limit</label>
                    <div className="flex gap-2 mb-2">
                      <button onClick={() => setGasMode('auto')} className={`px-3 py-1 rounded ${gasMode === 'auto' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>Auto</button>
                      <button onClick={() => setGasMode('500000')} className={`px-3 py-1 rounded ${gasMode === '500000' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>500000</button>
                      <button onClick={() => setGasMode('1000000')} className={`px-3 py-1 rounded ${gasMode === '1000000' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>1000000</button>
                    </div>
                    <input type="number" value={customGas} onChange={(e) => setCustomGas(e.target.value)} placeholder="或输入自定义 Gas" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">滑点 (%)</label>
                    <div className="flex gap-2 mb-2">
                      <button onClick={() => setSlippageMode('auto')} className={`px-3 py-1 rounded text-sm ${slippageMode === 'auto' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>Auto</button>
                      <button onClick={() => setSlippageMode('0.5')} className={`px-3 py-1 rounded text-sm ${slippageMode === '0.5' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>0.5%</button>
                      <button onClick={() => setSlippageMode('5')} className={`px-3 py-1 rounded text-sm ${slippageMode === '5' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>5%</button>
                      <button onClick={() => setSlippageMode('10')} className={`px-3 py-1 rounded text-sm ${slippageMode === '10' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>10%</button>
                      <button onClick={() => setSlippageMode('30')} className={`px-3 py-1 rounded text-sm ${slippageMode === '30' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>30%</button>
                    </div>
                    <input type="number" value={customSlippage} onChange={(e) => setCustomSlippage(e.target.value)} placeholder="或输入自定义滑点" step="0.1" className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>
              </div>

              {/* 第三步：代币选择 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">第三步：代币选择</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">输入代币</label>
                    <select value={selectedTokenIn} onChange={(e) => setSelectedTokenIn(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">-- 选择代币 --</option>
                      {uniqueTokens.map((token) => (
                        <option key={token.address} value={token.address}>{token.symbol} ({token.address.slice(0, 6)}...)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">输出代币</label>
                    <select value={selectedTokenOut} onChange={(e) => setSelectedTokenOut(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">-- 选择代币 --</option>
                      {uniqueTokens.map((token) => (
                        <option key={token.address} value={token.address}>{token.symbol} ({token.address.slice(0, 6)}...)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">输入数量</label>
                    <input type="number" value={amountIn} onChange={(e) => setAmountIn(e.target.value)} placeholder="输入交换数量" step="0.0001" min="0" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {amountOut && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-xs text-green-600 mb-1">预期输出</p>
                      <p className="text-sm font-semibold text-green-900">{amountOut}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 第四步：执行交换 */}
              <button onClick={handleSwap} disabled={loading || !fromAddress || !isPairAddressValid || !selectedTokenIn || !selectedTokenOut || !amountIn} className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors text-lg">
                {loading ? '交换中...' : '确认交换'}
              </button>
            </div>

            {/* 右侧：快速操作 */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">快速操作</h3>
                <div className="space-y-2">
                  <button onClick={handleClickWrapBNBButton} className="w-full px-4 py-2 bg-green-100 text-green-700 font-semibold rounded-lg hover:bg-green-200 transition-colors text-sm">
                    💰 包装 WBNB
                  </button>
                  <button onClick={() => setShowAddTokenModal(true)} className="w-full px-4 py-2 bg-purple-100 text-purple-700 font-semibold rounded-lg hover:bg-purple-200 transition-colors text-sm">
                    ➕ 添加代币
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 包装 WBNB 弹窗 */}
      {showWrapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">包装 BNB 为 WBNB</h3>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">BNB 数量</label>
                <input type="number" value={wrapAmount} onChange={(e) => setWrapAmount(e.target.value)} placeholder="输入 BNB 数量" step="0.0001" min="0" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleExecuteWrapBNB} disabled={loading} className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors">
                {loading ? '处理中...' : '确认'}
              </button>
              <button onClick={() => { setShowWrapModal(false); setWrapAmount(''); }} className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400 transition-colors">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加代币弹窗 */}
      {showAddTokenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">添加新代币</h3>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">代币符号</label>
                <input type="text" value={newTokenSymbol} onChange={(e) => setNewTokenSymbol(e.target.value)} placeholder="如：USDT" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">代币地址</label>
                <input type="text" value={newTokenAddress} onChange={(e) => setNewTokenAddress(e.target.value)} placeholder="0x..." className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">精度（Decimals）</label>
                <input type="number" value={newTokenDecimals} onChange={(e) => setNewTokenDecimals(e.target.value)} min="0" max="255" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAddTokenToDatabase} disabled={loading} className="flex-1 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors">
                {loading ? '添加中...' : '确认'}
              </button>
              <button onClick={() => { setShowAddTokenModal(false); setNewTokenSymbol(''); setNewTokenAddress(''); setNewTokenDecimals('18'); }} className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400 transition-colors">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SwapPage;
