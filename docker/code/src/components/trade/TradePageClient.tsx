'use client';

import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import UnifiedAddressSelector from '@/components/common/UnifiedAddressSelector';
import { fetchCustomTokens, fetchAddressAliases, fetchTokenBalances, type CustomToken } from '@/lib/addressService';

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

const TradePageClient: React.FC = () => {
  const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [addressAliases, setAddressAliases] = useState<AddressEntry[]>([]);
  
  const [fromAddress, setFromAddress] = useState('');
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([]);
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
  const [txStatus, setTxStatus] = useState<'pending' | 'confirmed' | 'failed' | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const tokenDropdownRef = useRef<HTMLDivElement>(null);

  // 注意：前端组件中的 networks 数组主要用于显示，实际 RPC 调用通过后端 API 完成
  const networks = [
    { id: 'fork', name: 'Fork 网络', rpc: 'http://anvil-api:8545' }, // 仅供显示，实际通过 API 调用
    { id: 'ethereum', name: 'Ethereum', rpc: 'https://mainnet.infura.io/v3/YOUR_KEY' },
    { id: 'bsc', name: 'BSC', rpc: 'https://bsc-dataseed1.bnbchain.org' },
    { id: 'polygon', name: 'Polygon', rpc: 'https://polygon-rpc.com' },
  ];

  // 过滤代币根据搜索关键字
  const allTokensForFilter: any[] = [{ symbol: 'BNB', address: null }, ...customTokens];
  const filteredTokens = allTokensForFilter.filter((tok: any) => {
    const tokenSym = tok && tok.symbol ? String(tok.symbol) : '';
    const searchKey = String(tokenSearchKeyword);
    return tokenSym.toLocaleLowerCase().includes(searchKey.toLocaleLowerCase());
  });

  // 初始化：获取代币列表
  useEffect(() => {
    const loadTokens = async () => {
      const tokens = await fetchCustomTokens();
      setCustomTokens(tokens);
    };
    loadTokens();
  }, []);

  useEffect(() => {
    fetchChainInfo();
    const interval = setInterval(fetchChainInfo, 5000);
    return () => clearInterval(interval);
  }, [selectedNetwork]);

  useEffect(() => {
    if (fromAddress) {
      const loadBalances = async () => {
        setBalancesLoading(true);
        try {
          const balances = await fetchTokenBalances(fromAddress);
          setTokenBalances(balances);
          setSelectedToken('BNB');
        } catch (err) {
          console.error('加载余额失败:', err);
          // 加载失败时不清空余额，保留之前的余额信息
          // 如果之前没有余额，至少确保 BNB 可以被识别
          setTokenBalances(prevBalances => {
            if (prevBalances.length === 0) {
              // 设置一个默认的 BNB 余额，确保至少可以识别 BNB
              return [{
                symbol: 'BNB',
                name: 'Binance Coin',
                balance: '0',
                formatted: '0',
                decimals: 18,
                contractAddress: null,
              }];
            }
            return prevBalances; // 保留原有余额
          });
        } finally {
          setBalancesLoading(false);
        }
      };
      loadBalances();
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





  const getSelectedTokenBalance = (): TokenBalance | undefined => {
    // 先从 tokenBalances 中查找
    const found = tokenBalances.find((t) => t.symbol === selectedToken);
    if (found) return found;
    
    // 如果是 BNB，即使余额列表中找不到，也返回一个默认对象（避免余额未加载时无法转账）
    if (selectedToken === 'BNB') {
      return {
        symbol: 'BNB',
        name: 'Binance Coin',
        balance: '0',
        formatted: '0',
        decimals: 18,
        contractAddress: null,
      };
    }
    
    // 从自定义代币中查找
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



  const handleTransfer = async () => {
    console.log('🚀 开始转账流程...');
    console.log('发送方:', fromAddress);
    console.log('接收方:', toAddress);
    console.log('数量:', amount);
    console.log('代币:', selectedToken);

    if (!fromAddress || !toAddress || !amount) {
      const msg = '请填写所有必要字段';
      console.error('❌ 验证失败:', msg);
      setError(msg);
      return;
    }

    if (parseFloat(amount) <= 0) {
      const msg = '转账数量必须大于0';
      console.error('❌ 验证失败:', msg);
      setError(msg);
      return;
    }

    const selectedTokenBalance = getSelectedTokenBalance();
    console.log('选中代币信息:', selectedTokenBalance);
    
    if (!selectedTokenBalance) {
      const msg = `无法识别代币: ${selectedToken}`;
      console.error('❌ 验证失败:', msg);
      setError(msg);
      return;
    }

    if (selectedToken === 'BNB') {
      // 移除格式化字符串中的逗号以正确解析数字
      const balanceNumber = parseFloat(selectedTokenBalance.formatted?.replace(/,/g, '') || '0');
      const amountNumber = parseFloat(amount);
      
      console.log('余额验证:', {
        formatted: selectedTokenBalance.formatted,
        balanceNumber,
        amountNumber,
        isEnough: amountNumber <= balanceNumber
      });
      
      if (balanceNumber <= 0) {
        const msg = 'BNB余额不足';
        console.error('❌ 验证失败:', msg);
        setError(msg);
        return;
      }
      if (amountNumber > balanceNumber) {
        const msg = `BNB余额不足。可用余额: ${selectedTokenBalance.formatted} BNB`;
        console.error('❌ 验证失败:', msg);
        setError(msg);
        return;
      }
      console.log('✅ BNB 余额验证通过');
    }

    try {
      console.log('✅ 验证通过，开始发送转账请求...');
      setLoading(true);
      setError('');
      setSuccess('');
      setTxHash('');

      const requestBody = {
        fromAddress,
        toAddress,
        amount,
        tokenAddress: selectedTokenBalance?.contractAddress || null,
      };
      console.log('请求体:', requestBody);

      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('收到响应，状态码:', response.status);
      const data = await response.json();
      console.log('响应数据:', data);

      if (data.success) {
        console.log('✅ 交易已提交，等待确认...');
        // 交易已提交，设置状态为 pending
        setTxHash(data.txHash);
        setTxStatus('pending');
        setSuccess(`交易已提交，等待确认中...\n\n交易哈希: ${data.txHash}`);
        setError('');
        setToAddress('');
        setAmount('');
        
        // 立即重置 loading 状态
        setLoading(false);
        
        // 立即检查一次交易状态
        checkTransactionStatus(data.txHash);
        
        // 异步刷新余额（不阻塞 UI）
        fetchTokenBalances(fromAddress)
          .then(balances => {
            setTokenBalances(balances);
          })
          .catch(err => {
            console.warn('刷新余额失败:', err);
          });
      } else {
        console.error('❌ 转账失败:', data.error);
        setError(data.error || '转账失败');
        setLoading(false);
        
        // 转账失败时也刷新余额，确保状态同步
        // 只刷新选中代币的余额，避免清空其他代币的余额信息
        fetchTokenBalances(fromAddress, selectedToken === 'BNB' ? ['BNB'] : [selectedToken])
          .then(newBalances => {
            // 合并新旧余额，保留已存在的代币余额
            setTokenBalances(prevBalances => {
              const balanceMap = new Map(prevBalances.map(b => [b.symbol, b]));
              // 更新或添加新余额
              newBalances.forEach(b => {
                balanceMap.set(b.symbol, b);
              });
              return Array.from(balanceMap.values());
            });
          })
          .catch(err => {
            console.warn('刷新余额失败:', err);
            // 刷新失败时保留原有余额，不清空
          });
      }
    } catch (err) {
      console.error('❌ 转账异常:', err);
      setError(err instanceof Error ? err.message : '转账失败');
      setLoading(false);
      
        // 转账异常时也刷新余额
        // 只刷新选中代币的余额，避免清空其他代币的余额信息
        fetchTokenBalances(fromAddress, selectedToken === 'BNB' ? ['BNB'] : [selectedToken])
          .then(newBalances => {
            // 合并新旧余额，保留已存在的代币余额
            setTokenBalances(prevBalances => {
              const balanceMap = new Map(prevBalances.map(b => [b.symbol, b]));
              // 更新或添加新余额
              newBalances.forEach(b => {
                balanceMap.set(b.symbol, b);
              });
              return Array.from(balanceMap.values());
            });
          })
          .catch(err => {
            console.warn('刷新余额失败:', err);
            // 刷新失败时保留原有余额，不清空
          });
    }
  };

  // 检查交易状态
  const checkTransactionStatus = async (hash: string) => {
    if (!hash) return;
    
    setCheckingStatus(true);
    try {
      const response = await fetch(`/api/transfer/status?txHash=${encodeURIComponent(hash)}`);
      const data = await response.json();
      
      if (data.success) {
        setTxStatus(data.status);
        
        if (data.status === 'confirmed') {
          setSuccess(`✅ 交易已确认！\n\n交易哈希: ${hash}`);
          // 交易确认后刷新余额
          fetchTokenBalances(fromAddress)
            .then(balances => {
              setTokenBalances(balances);
            })
            .catch(err => {
              console.warn('刷新余额失败:', err);
            });
        } else if (data.status === 'failed') {
          setError(`❌ 交易失败\n\n交易哈希: ${hash}`);
          setTxStatus('failed');
        } else if (data.status === 'pending') {
          setSuccess(`交易等待确认中...\n\n交易哈希: ${hash}\n\n状态: 待确认`);
        }
      } else {
        console.error('检查交易状态失败:', data.error);
      }
    } catch (err) {
      console.error('检查交易状态异常:', err);
    } finally {
      setCheckingStatus(false);
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

          <div className="grid grid-cols-1">
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

                {/* 交易状态显示 */}
                {txHash && (
                  <div className={`p-4 border rounded-lg space-y-3 ${
                    txStatus === 'confirmed' 
                      ? 'bg-green-50 border-green-200' 
                      : txStatus === 'failed'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${
                          txStatus === 'confirmed' 
                            ? 'text-green-800' 
                            : txStatus === 'failed'
                            ? 'text-red-800'
                            : 'text-yellow-800'
                        }`}>
                          {txStatus === 'confirmed' && '✅ 交易已确认'}
                          {txStatus === 'failed' && '❌ 交易失败'}
                          {txStatus === 'pending' && '⏳ 等待确认中...'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1 font-mono break-all">
                          交易哈希: {txHash}
                        </p>
                      </div>
                      <button
                        onClick={() => checkTransactionStatus(txHash)}
                        disabled={checkingStatus}
                        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded transition-colors"
                      >
                        {checkingStatus ? '检查中...' : '刷新状态'}
                      </button>
                    </div>
                    {txStatus === 'pending' && (
                      <p className="text-xs text-yellow-700">
                        ⚠️ 请等待交易确认后再进行下一次转账
                      </p>
                    )}
                  </div>
                )}

                {/* 成功提示（无交易哈希时显示） */}
                {success && !txHash && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">{success}</p>
                  </div>
                )}

                {/* 发送方 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    发送方账户 *
                  </label>
                  <UnifiedAddressSelector
                    value={fromAddress}
                    onChange={setFromAddress}
                    placeholder="搜索或选择发送账户..."
                  />

                  {fromAddress && (
                    <div className="space-y-2 mt-3">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-600 mb-1">账户地址</p>
                        <p className="text-sm font-mono text-blue-900 break-all">{fromAddress}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 代币选择 */}
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

                  {showTokenDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
                      <div className="p-3 border-b border-gray-200 sticky top-0 bg-white">
                        <input
                          type="text"
                          value={tokenSearchKeyword}
                          onChange={(e) => setTokenSearchKeyword(e.target.value)}
                          placeholder="搜索代币符号..."
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="max-h-64 overflow-y-auto">
                        {filteredTokens.length === 0 ? (
                          <div className="px-4 py-6 text-center text-gray-500 text-sm">
                            没有找到匹配的代币
                          </div>
                        ) : (
                          filteredTokens.map((token) => {
                            const balance = tokenBalances.find((t) => t.symbol === token.symbol);
                            return (
                              <button
                                key={token.symbol}
                                onClick={() => handleSelectToken(token.symbol)}
                                className={`w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                                  selectedToken === token.symbol ? 'bg-blue-50' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-gray-900">{token.symbol}</span>
                                  <span className="text-sm text-gray-600">
                                    {balance ? `余额: ${balance.formatted}` : '余额: 0'}
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
                  <UnifiedAddressSelector
                    value={toAddress}
                    onChange={setToAddress}
                    placeholder="搜索或选择接收账户..."
                  />
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
                  disabled={loading || !fromAddress || !toAddress || !amount || txStatus === 'pending'}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                >
                  {loading 
                    ? '转账中...' 
                    : txStatus === 'pending' 
                    ? '等待交易确认...' 
                    : '确认转账'}
                </button>
              </div>
            </div>

            {/* 右侧：说明 */}
          </div>
        </div>
      </div>
    </>
  );
};

export default TradePageClient;
