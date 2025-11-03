'use client';

import { useState, useEffect } from 'react';

interface Chain {
  key: string;
  name: string;
  id: number;
  rpcUrl: string;
  nodes?: Array<{ nodeName: string; rpcUrl: string }>; // 此网络的所有RPC节点
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
  const [selectedRpcUrl, setSelectedRpcUrl] = useState<string>(''); // 选中的RPC URL
  const [blockNumber, setBlockNumber] = useState<string>('');
  const [forkPort, setForkPort] = useState<string>('8545');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isForking, setIsForking] = useState(initialIsForking || false);
  const [currentConfig, setCurrentConfig] = useState<ForkConfig | null>(null);
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

  // 网络选择变化时，同时更新RPC URL
  const handleChainChange = (chainKey: string) => {
    setSelectedChain(chainKey);
    const chainInfo = chains.find((c) => c.key === chainKey);
    if (chainInfo) {
      // 优先使用该网络的第一个RPC节点，如果没有则使用默认RPC
      const rpcUrl = chainInfo.nodes && chainInfo.nodes.length > 0 
        ? chainInfo.nodes[0].rpcUrl 
        : chainInfo.rpcUrl;
      setSelectedRpcUrl(rpcUrl);
    }
  };

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
        // 第一次加载时，默认设置选中Chain的第一个RPC节点
        if (!selectedRpcUrl && configData.chains.length > 0) {
          const defaultChain = configData.chains.find((c: Chain) => c.key === selectedChain) || configData.chains[0];
          if (defaultChain?.nodes && defaultChain.nodes.length > 0) {
            setSelectedRpcUrl(defaultChain.nodes[0].rpcUrl);
          } else {
            setSelectedRpcUrl(defaultChain.rpcUrl);
          }
        }
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
    if (!blockNumber || !selectedChain || !selectedRpcUrl) {
      setError('请选择网络、RPC节点并填入区块号');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/fork/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rpcUrl: selectedRpcUrl, // 使用选中的RPC URL
          blockNumber: parseInt(blockNumber),
          forkPort: parseInt(forkPort),
          chainId: chains.find(c => c.key === selectedChain)?.id,
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
            onChange={(e) => handleChainChange(e.target.value)}
            disabled={isForking || loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {(chains || []).map((chain) => (
              <option key={chain.key} value={chain.key} className="text-gray-900">
                {chain.name} (Chain ID: {chain.id})
              </option>
            ))}
          </select>
        </div>

        {/* RPC节点选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">选择RPC节点</label>
          <select
            value={selectedRpcUrl || ''}
            onChange={(e) => setSelectedRpcUrl(e.target.value)}
            disabled={isForking || loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {selectedChainInfo ? (
              selectedChainInfo.nodes && selectedChainInfo.nodes.length > 0 ? (
                selectedChainInfo.nodes.map((node, index) => (
                  <option key={index} value={node.rpcUrl}>
                    {node.nodeName}
                  </option>
                ))
              ) : (
                <option value={selectedChainInfo.rpcUrl}>
                  {selectedChainInfo.name} - 默认RPC
                </option>
              )
            ) : null}
          </select>
          <p className="text-xs text-gray-500 mt-1">当前RPC: {selectedRpcUrl || selectedChainInfo?.rpcUrl}</p>
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
