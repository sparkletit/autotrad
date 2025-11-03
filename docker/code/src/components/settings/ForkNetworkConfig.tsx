'use client';

import { useState, useEffect } from 'react';

interface Chain {
  key: string;
  name: string;
  id: number;
  rpcUrl: string;
}

interface ForkConfig {
  networkId: number;
  blockNumber: number;
  rpcUrl: string;
  forkPort: number;
}

interface ForkNetworkConfigProps {
  onForkSuccess?: (config: ForkConfig) => void;
  onForkStateChange?: (isForking: boolean) => void;
  isForking?: boolean;
}

export default function ForkNetworkConfig({ onForkSuccess, onForkStateChange, isForking: initialIsForking }: ForkNetworkConfigProps) {
  const [chains, setChains] = useState<Chain[]>([]);
  const [selectedChain, setSelectedChain] = useState<string>('bsc');
  const [blockNumber, setBlockNumber] = useState<string>('');
  const [forkPort, setForkPort] = useState<string>('8545');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isForking, setIsForking] = useState(initialIsForking || false);
  const [currentConfig, setCurrentConfig] = useState<ForkConfig | null>(null);
  const [editingRpcUrl, setEditingRpcUrl] = useState<string>('');
  const [showRpcEditor, setShowRpcEditor] = useState(false);
  const [fetchingLatestBlock, setFetchingLatestBlock] = useState(false);

  // 获取可用网络列表和当前配置
  useEffect(() => {
    fetchConfig();
    // 只有Fork运行时才定时刷新
    let interval: NodeJS.Timeout;
    if (isForking) {
      interval = setInterval(fetchConfig, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isForking]);

  const fetchConfig = async () => {
    try {
      // 先检测实际的Anvil是否运行
      const statusResponse = await fetch('/api/fork/status');
      const statusData = await statusResponse.json();

      // 不管是否运行，都获取可用网络列表
      const configResponse = await fetch('/api/fork/config');
      const configData = await configResponse.json();
      
      if (configData.success) {
        setChains(configData.chains);
      }

      // 使用实际检测结果更新Fork是否运行
      if (statusData.isRunning) {
        setIsForking(true);
        onForkStateChange?.(true);
        setCurrentConfig({
          networkId: statusData.chainId,
          blockNumber: statusData.blockNumber,
          rpcUrl: statusData.rpcUrl,
          forkPort: 8545,
        });
      } else {
        setIsForking(false);
        onForkStateChange?.(false);
        setCurrentConfig(null);
      }
    } catch (err) {
      console.error('获取配置失败:', err);
      setIsForking(false);
      setCurrentConfig(null);
    }
  };

  const handleFork = async () => {
    if (!blockNumber || !selectedChain) {
      setError('请选择网络和填入区块号');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 通过start API启动anvil容器
      const chainInfo = chains.find(c => c.key === selectedChain);
      if (!chainInfo) {
        setError('网络信息获取失败');
        return;
      }

      const response = await fetch('/api/fork/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rpcUrl: chainInfo.rpcUrl,
          blockNumber: parseInt(blockNumber),
          forkPort: parseInt(forkPort),
          chainId: chainInfo.id,
        }),
      });

      const data = await response.json();

      if (data.success && data.command) {
        // 显示启动命令
        setError(`
请在宿主机执行以下命令启动Anvil（区块号${blockNumber}）:

${data.command}

执行完后，Fork网络会自动检测并显示在上方`);
      } else if (data.success) {
        // 立即刷新状态
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetchConfig();
        setIsForking(true);
        onForkSuccess?.(data.config);
      } else {
        setError(data.error || 'Fork启动失败');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Fork启动失败';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGetLatestBlock = async () => {
    if (!selectedChain) {
      setError('请先选择网络');
      return;
    }

    setFetchingLatestBlock(true);
    setError('');

    try {
      const response = await fetch(`/api/fork/latest-block?chainKey=${selectedChain}`);
      const data = await response.json();

      if (data.success) {
        setBlockNumber(data.blockNumber.toString());
      } else {
        setError(`获取最新区块号失败: ${data.error}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '获取最新区块号失败';
      setError(errorMsg);
    } finally {
      setFetchingLatestBlock(false);
    }
  };

  const handleStopFork = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/fork/stop', {
        method: 'DELETE',
      });

      const data = await response.json();
      console.log('停止Fork响应:', data);

      if (data.success) {
        // 显示停止命令提示
        if (data.command) {
          setError(`
请在宿主机执行以下命令停止Anvil:

${data.command}

执行完后，Fork网络会自动检测并更新`);
        }
        // 立即刷新状态
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchConfig();
        setIsForking(false);
        onForkStateChange?.(false);
        // 清空区块号，以便下一次可以输入新的区块号
        setBlockNumber('');
      } else {
        setError(data.error || '停止Fork失败');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '停止Fork失败';
      console.error('停止Fork错误:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const selectedChainInfo = chains.find((c) => c.key === selectedChain);

  const handleSaveRpcUrl = async () => {
    if (!editingRpcUrl.trim()) {
      setError('请输入有效的RPC URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/rpc-nodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chainKey: selectedChain,
          rpcUrl: editingRpcUrl,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 更新chains中的RPC URL
        setChains(chains.map((c) => 
          c.key === selectedChain 
            ? { ...c, rpcUrl: editingRpcUrl }
            : c
        ));
        setShowRpcEditor(false);
      } else {
        setError(data.error || '保存RPC配置失败');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '保存RPC配置失败';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-6 text-gray-900">Fork网络配置</h2>

      {/* 当前Fork状态 */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">当前状态</p>
            <p className="text-lg font-semibold text-gray-900">
              {isForking ? '✅ Fork网络运行中' : '⭕ Fork网络未启动'}
            </p>
          </div>
          {currentConfig && (
            <div className="text-right">
              <p className="text-sm text-gray-600">RPC: {currentConfig.rpcUrl}</p>
              <p className="text-sm text-gray-600">区块号: {currentConfig.blockNumber}</p>
            </div>
          )}
        </div>
        {isForking && (
          <button
            onClick={handleStopFork}
            disabled={loading}
            className="mt-3 w-full py-2 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? '停止中...' : '停止Fork'}
          </button>
        )}
      </div>

      {/* 配置表单 */}
      <div className="space-y-4">
        {/* 网络选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">选择网络</label>
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value)}
            disabled={isForking || loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {(chains || []).map((chain) => (
              <option key={chain.key} value={chain.key} className="text-gray-900">
                {chain.name} (Chain ID: {chain.id})
              </option>
            ))}
          </select>
          {selectedChainInfo && (
            <p className="text-xs text-gray-500 mt-1">RPC: {selectedChainInfo.rpcUrl}</p>
          )}
        </div>

        {/* 区块号配置 */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            要Fork的区块号
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={blockNumber}
              onChange={(e) => setBlockNumber(e.target.value)}
              placeholder="输入区块号（如: 20000000）"
              disabled={isForking || loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleGetLatestBlock}
              disabled={isForking || loading || fetchingLatestBlock || !selectedChain}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors text-sm whitespace-nowrap"
              title="获取最新区块号"
            >
              {fetchingLatestBlock ? '获取中...' : '获取最新'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            使用最近的区块号以获得最新的链上状态
          </p>
        </div>

        {/* RPC URL配置编辑 */}
        {showRpcEditor && (
          <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-900">编辑RPC URL</p>
              <button
                onClick={() => setShowRpcEditor(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={editingRpcUrl}
                onChange={(e) => setEditingRpcUrl(e.target.value)}
                placeholder="输入RPC URL (例如: https://...)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveRpcUrl}
                  disabled={loading || !editingRpcUrl.trim()}
                  className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {loading ? '保存中...' : '保存RPC'}
                </button>
                <button
                  onClick={() => setShowRpcEditor(false)}
                  className="flex-1 py-2 px-3 bg-gray-300 hover:bg-gray-400 text-gray-900 text-sm font-medium rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RPC URL显示和编辑按钮 */}
        {!showRpcEditor && (
          <div className="p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">当前RPC</p>
                <p className="text-sm font-mono text-gray-900 break-all">
                  {selectedChainInfo?.rpcUrl}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingRpcUrl(selectedChainInfo?.rpcUrl || '');
                  setShowRpcEditor(true);
                }}
                className="ml-2 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex-shrink-0"
              >
                编辑
              </button>
            </div>
          </div>
        )}

        {/* Fork端口配置 */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Anvil监听端口
          </label>
          <input
            type="number"
            value={forkPort}
            onChange={(e) => setForkPort(e.target.value)}
            disabled={isForking || loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 mt-1">默认: 8545</p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className={`p-4 rounded border ${
            error.includes('请在宿主机')
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-red-50 border-red-200 text-red-700'
          } text-sm`}>
            <div className="whitespace-pre-wrap break-words font-mono text-xs mb-2">
              {error}
            </div>
            {error.includes('请在宿主机') && (
              <button
                onClick={() => {
                  const command = error.split('\n\n')[1];
                  if (command && navigator.clipboard) {
                    navigator.clipboard.writeText(command).then(() => {
                      alert('已复制命令到剪贴板');
                    }).catch(() => {
                      alert('复制失败，请手动复制');
                    });
                  } else if (command) {
                    // Fallback: 如果 clipboard 不可用，使用 textarea 方法
                    const textarea = document.createElement('textarea');
                    textarea.value = command;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    alert('已复制命令到剪贴板');
                  }
                }}
                className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
              >
                复制命令
              </button>
            )}
          </div>
        )}

        {/* Fork按钮 */}
        <button
          onClick={handleFork}
          disabled={loading || isForking}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? '启动中...' : isForking ? '已启动' : '启动Fork'}
        </button>
      </div>
    </div>
  );
}
