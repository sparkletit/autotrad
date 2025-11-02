'use client';

import { useState, useEffect } from 'react';

interface Token {
  symbol: string;
  name: string;
  decimals: number;
  address: string | null;
}

interface Balance {
  token: string;
  balance: string;
  formatted: string;
}

interface MintFunctionProps {
  selectedAddress?: string;
  isForkActive?: boolean;
}

export default function MintFunction({ selectedAddress, isForkActive }: MintFunctionProps) {
  const [supportedTokens, setSupportedTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>('BNB');
  const [mintAmount, setMintAmount] = useState<string>('');
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isMintingMainnet, setIsMintingMainnet] = useState(false);
  const [realForkStatus, setRealForkStatus] = useState(false);
  const [forkConfig, setForkConfig] = useState<any>(null);

  // 实时检查Fork状态使用与 ForkNetworkConfig 相同的检查方法
  useEffect(() => {
    const checkForkStatus = async () => {
      try {
        // 使用与 ForkNetworkConfig 相同的检查方法：直接检测 RPC 是否响应
        const statusResponse = await fetch('/api/fork/status');
        const statusData = await statusResponse.json();
        console.log('Fork status check result:', statusData);
        if (statusData.success) {
          setRealForkStatus(statusData.isRunning || false);
        }
        
        // 同时获取Fork配置信息
        const configResponse = await fetch('/api/fork/config');
        const configData = await configResponse.json();
        if (configData.success) {
          setForkConfig(configData);
        }
      } catch (err) {
        console.error('检查Fork状态失败:', err);
        setRealForkStatus(false);
      }
    };
    
    if (selectedAddress) {
      // 立即检查一次
      checkForkStatus();
      // 定时检查状态
      const interval = setInterval(checkForkStatus, 1000);
      return () => clearInterval(interval);
    }
  }, [selectedAddress]);

  // 获取支持的代币和余额
  useEffect(() => {
    if (selectedAddress && realForkStatus) {
      fetchTokensAndBalance();
    }
  }, [selectedAddress, realForkStatus]);

  const fetchTokensAndBalance = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/fork/mint?address=${selectedAddress}`);
      const data = await response.json();

      if (data.success) {
        setSupportedTokens(data.supportedTokens);
        if (data.balances) {
          setBalances(data.balances);
        }
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error('获取代币信息失败:', err);
      setError('获取代币信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async () => {
    if (!selectedAddress) {
      setError('请先选择账号');
      return;
    }

    if (!mintAmount || parseFloat(mintAmount) <= 0) {
      setError('请输入有效的Mint数量');
      return;
    }

    if (!realForkStatus) {
      setError('Fork网络未启动');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/fork/mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: selectedAddress,
          amount: mintAmount,
          token: selectedToken,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功Mint ${mintAmount} ${selectedToken}！`);
        setMintAmount('');
        // 刷新余额
        await fetchTokensAndBalance();
      } else {
        setError(data.error || 'Mint失败');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Mint失败';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedAddress) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900">Mint主网资产到Fork</h2>
        <p className="text-gray-500 text-center py-8">请先在上方选择账号</p>
      </div>
    );
  }

  if (!realForkStatus) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900">Mint主网资产到Fork</h2>
        <div className="text-gray-600 space-y-3">
          <p>正在检查Fork网络是否已启动...</p>
          <p className="text-sm text-gray-500">注意：Fork网络应处于运行状态。</p>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
            <p className="font-semibold mb-2">调试信息：</p>
            <p>检查地址: http://host.docker.internal:8545</p>
            <p>检查间隔: 1秒</p>
            <p>如果Fork网络已启动，请确保Anvil在宿主机的8545端口运行</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-6 text-gray-900">Mint主网资产到Fork</h2>
      <p className="text-sm text-gray-600 mb-6">不兹人设定明细的账户和需要Mint的资产类型</p>

      {/* 账号信息 */}
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
        <p className="text-sm text-gray-600 mb-1">选中的账号</p>
        <p className="text-sm font-mono text-gray-900 break-all">{selectedAddress}</p>
      </div>

      {/* 钱包余额 */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">钱包余额</h3>
        <div className="space-y-2">
          {balances.length > 0 ? (
            balances.map((balance) => (
              <div key={balance.token} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                <span className="text-sm font-medium text-gray-900">{balance.token}</span>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{balance.formatted}</p>
                  <p className="text-xs text-gray-500">{balance.balance}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">暂无余额信息</p>
          )}
        </div>
      </div>

      {/* Mint表单 */}
      <div className="space-y-4 border-t border-gray-200 pt-6">
        {/* 主网资产显示（仅BNB） */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            主网资产
          </label>
          <div className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900">
            <span className="font-medium">BNB - Binance Coin</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">主网原生资产，仅支持Mint BNB</p>
        </div>

        {/* Mint数量 */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Mint数量
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
              placeholder="输入Mint数量"
              disabled={loading}
              step="0.01"
              min="0"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setMintAmount('1000')}
              className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition-colors"
              disabled={loading}
            >
              100
            </button>
            <button
              onClick={() => setMintAmount('10000')}
              className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition-colors"
              disabled={loading}
            >
              1000
            </button>
                        <button
              onClick={() => setMintAmount('100000')}
              className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition-colors"
              disabled={loading}
            >
              100000
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 成功提示 */}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* Mint按预 */}
        <button
          onClick={handleMint}
          disabled={loading || !mintAmount}
          className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? '处理中...' : 'Mint BNB'}
        </button>
      </div>
    </div>
  );
}
