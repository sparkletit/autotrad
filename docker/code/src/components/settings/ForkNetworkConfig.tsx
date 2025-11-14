'use client';

import { useState, useEffect } from 'react';
import SaveStateButton from '@/components/fork/SaveStateButton';
import apiService from '@/lib/apiService';

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
  // 时间推进相关状态
  const [currentForkTime, setCurrentForkTime] = useState<{ blockNumber: number; timestamp: number } | null>(null);
  const [advanceSeconds, setAdvanceSeconds] = useState<string>('');
  const [nextTimestamp, setNextTimestamp] = useState<string>('');
  const [mineBlocks, setMineBlocks] = useState<string>('1');
  const [intervalSeconds, setIntervalSeconds] = useState<string>('1');
  const [timeMessage, setTimeMessage] = useState<string>('');
  const [timeLoading, setTimeLoading] = useState<boolean>(false);
  const [reachTimestamp, setReachTimestamp] = useState<string>('');
  const [savedStates, setSavedStates] = useState<Array<{ 
    name: string; 
    fileName: string; 
    modifiedAt: string;
    forkConfig?: {
      rpcUrl: string;
      blockNumber: number;
      chainId: number;
      chainKey: string;
    } | null;
  }>>([]);
  const [loadFromState, setLoadFromState] = useState(false);
  const [selectedState, setSelectedState] = useState<string>('');
  const [stateLoadRequested, setStateLoadRequested] = useState(false); // 标记是否需要加载状态

  // 获取可用网络列表和当前配置
  useEffect(() => {
    fetchConfig();
    fetchSavedStates();
    // 只有Fork运行时才定时刷新
    let interval: NodeJS.Timeout;
    if (isForking) {
      interval = setInterval(fetchConfig, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isForking]);

  // 获取已保存的状态列表
  const fetchSavedStates = async () => {
    try {
      const { success, data } = await apiService.get('/api/fork/save-state');
      if (success) {
        setSavedStates((data as any) || []);
      }
    } catch (err) {
      console.error('获取保存的状态列表失败:', err);
    }
  };

  // 当选择状态时，自动填充 fork 参数
  const handleStateSelect = (stateName: string) => {
    setSelectedState(stateName);
    setError(''); // 清除之前的错误
    if (stateName) {
      const state = savedStates.find(s => s.name === stateName);
      if (state?.forkConfig) {
        // 自动填充 fork 参数
        setSelectedChain(state.forkConfig.chainKey);
        setSelectedRpcUrl(state.forkConfig.rpcUrl);
        setBlockNumber(state.forkConfig.blockNumber.toString());
        console.log(`✅ 已自动填充状态 "${stateName}" 的 fork 参数:`, state.forkConfig);
        setError(`✅ 已自动填充 fork 参数：${state.forkConfig.chainKey.toUpperCase()} 网络，区块 ${state.forkConfig.blockNumber}`);
      } else {
        console.warn(`⚠️ 状态 "${stateName}" 没有保存 fork 参数`);
        setError(`⚠️ 此状态是旧版本保存的，缺少 fork 参数（网络、RPC、区块号）。\n\n请手动选择网络、RPC 和区块号，或者重新保存一次此状态以包含完整参数。`);
      }
    }
  };

  // 删除状态
  const handleDeleteState = async (stateName: string) => {
    if (!confirm(`确定要删除状态 "${stateName}" 吗？此操作不可恢复。`)) {
      return;
    }

    setLoading(true);
    try {
      const { success, error } = await apiService.delete(`/api/fork/save-state?stateName=${encodeURIComponent(stateName)}`);
      if (success) {
        console.log(`✅ 状态 "${stateName}" 已删除`);
        // 如果删除的是当前选中的状态，清空选择
        if (selectedState === stateName) {
          setSelectedState('');
        }
        // 刷新列表
        await fetchSavedStates();
      } else {
        setError(error || '删除失败');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '删除失败';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 网络选择变化时，同时更新RPC URL
  const handleChainChange = (chainKey: string) => {
    setSelectedChain(chainKey);
    const chainInfo = chains.find((c) => c.key === chainKey);
    if (chainInfo) {
      // 优先使用该网络的第一个RPC节点，如果没有则使用默认RPC
      const firstNode = chainInfo.nodes && chainInfo.nodes.length > 0 ? chainInfo.nodes[0] : undefined;
      const rpcUrl = firstNode
        ? (firstNode as any).rpcUrl || (firstNode as any).rpc_url || chainInfo.rpcUrl
        : chainInfo.rpcUrl;
      setSelectedRpcUrl(rpcUrl);
    }
  };

  const fetchConfig = async () => {
    try {
      // 先检测实际的Anvil是否运行
      const { success: sSucc, data: sData } = await apiService.get('/api/fork/status', { cache: 'no-store', retry: 1 });
      const statusData = sData as any;

      // 不管是否运行，都获取可用网络列表
      const { success: cSucc, data: cData } = await apiService.get('/api/fork/config', { cache: 'no-store', retry: 1 });
      const configData = cData as any;
      
      if (cSucc && Array.isArray(configData?.chains)) {
        const chainsData: Chain[] = configData.chains;
        setChains(chainsData);

        // 保证 selectedChain、selectedRpcUrl 与最新的链/节点一致
        const desiredChain = chainsData.find((c) => c.key === selectedChain) || chainsData[0];
        if (desiredChain) {
          const nextChainKey = desiredChain.key;
          const nextRpc = desiredChain.nodes && desiredChain.nodes.length > 0 ? desiredChain.nodes[0].rpcUrl : desiredChain.rpcUrl;
          setSelectedChain(nextChainKey);
          setSelectedRpcUrl(nextRpc);
        } else {
          // 无可用链，清空选择
          setSelectedChain('');
          setSelectedRpcUrl('');
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
    // 验证输入（从状态加载时也需要 RPC 和区块号，因为要 fork 主网）
    if (!blockNumber || !selectedChain || !selectedRpcUrl) {
      setError('请选择网络、RPC节点并填入区块号');
      return;
    }

    if (loadFromState && !selectedState) {
      setError('请选择要加载的状态');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const requestBody: any = {
        rpcUrl: selectedRpcUrl,
        blockNumber: parseInt(blockNumber),
        forkPort: parseInt(forkPort),
        chainId: chains.find(c => c.key === selectedChain)?.id,
        loadState: loadFromState ? selectedState : null, // 传递状态名，让后端知道是否需要加载
      };

      const { success, data, error } = await apiService.post('/api/fork/start', requestBody);
      if (success && (data as any)?.command) {
        // 显示启动命令
        if (loadFromState) {
          // 从状态加载的特殊说明
          setError(`
请按以下步骤操作：

1️⃣ 在宿主机执行以下命令启动Anvil（Fork 主网区块 ${blockNumber}）:
${data.command}

2️⃣ 等待Anvil启动完成（约10-30秒，因为要Fork主网）

3️⃣ 点击下方的 "📥 加载状态" 按钮来加载 "${selectedState}" 状态

说明：先Fork主网保留所有合约（如交易池），然后加载你的状态覆盖修改的部分（如账户余额）。`);
        } else {
          setError(`
请在宿主机执行以下命令启动Anvil（区块号${blockNumber}）:

${data.command}

执行完后，Fork网络会自动检测并显示在上方`);
        }
        } else if (success) {
          // 立即刷新状态
          await new Promise(resolve => setTimeout(resolve, 2000));
          await fetchConfig();
          setIsForking(true);
          onForkSuccess?.((data as any).config);
        } else {
          setError(error || 'Fork启动失败');
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
      const { success, data, error } = await apiService.get(`/api/fork/latest-block?chainKey=${selectedChain}`);
      if (success) {
        setBlockNumber((data as any).blockNumber.toString());
      } else {
        setError(`获取最新区块号失败: ${error || ''}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '获取最新区块号失败';
      setError(errorMsg);
    } finally {
      setFetchingLatestBlock(false);
    }
  };

  const handleLoadState = async () => {
    if (!selectedState) {
      setError('请先选择要加载的状态');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { success, error } = await apiService.post('/api/fork/load-state', { stateName: selectedState });
      if (success) {
        setError('✅ 状态加载成功！网络已恢复到保存时的状态。');
        // 刷新配置
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchConfig();
      } else {
        setError(error || '加载状态失败');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加载状态失败';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleStopFork = async () => {
    setLoading(true);
    setError('');

    try {
      const { success, data, error } = await apiService.delete('/api/fork/stop');
      console.log('停止Fork响应:', data);

      if (success) {
        // 显示停止命令提示
        if ((data as any)?.command) {
          setError(`
请在宿主机执行以下命令停止Anvil:

${(data as any).command}

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
        setError(error || '停止Fork失败');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '停止Fork失败';
      console.error('停止Fork错误:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 获取当前 Fork 最新区块与时间戳
  const fetchCurrentForkTime = async () => {
    try {
      setTimeLoading(true);
      setTimeMessage('');
      const { success, data, error } = await apiService.get('/api/fork/time');
      if (success) {
        setCurrentForkTime((data as any));
      } else {
        setTimeMessage(error || '获取当前时间失败');
      }
    } catch (e: any) {
      setTimeMessage(e?.message || '获取当前时间失败');
    } finally {
      setTimeLoading(false);
    }
  };

  // 提交时间推进操作
  const submitTimeAction = async (payload: any) => {
    try {
      setTimeLoading(true);
      setTimeMessage('');
      const { success, data, error } = await apiService.post('/api/fork/time', payload);
      if (success) {
        setCurrentForkTime((data as any));
        setTimeMessage('✅ 操作成功');
      } else {
        setTimeMessage(error || '操作失败');
      }
    } catch (e: any) {
      setTimeMessage(e?.message || '操作失败');
    } finally {
      setTimeLoading(false);
    }
  };

  const handleIncreaseTime = async () => {
    const secondsNum = Number(advanceSeconds);
    if (!Number.isFinite(secondsNum) || secondsNum <= 0) {
      setTimeMessage('请输入有效的秒数');
      return;
    }
    await submitTimeAction({ action: 'increase', seconds: secondsNum });
  };

  const handleSetNextTimestamp = async () => {
    const tsNum = Number(nextTimestamp);
    if (!Number.isFinite(tsNum) || tsNum <= 0) {
      setTimeMessage('请输入有效的 Unix 时间戳（秒）');
      return;
    }
    await submitTimeAction({ action: 'set', timestamp: tsNum });
  };

  const handleMineBlocks = async () => {
    const blocksNum = Number(mineBlocks);
    if (!Number.isFinite(blocksNum) || blocksNum <= 0) {
      setTimeMessage('请输入有效的出块数量');
      return;
    }
    await submitTimeAction({ action: 'mine', blocks: blocksNum });
  };

  const handleSetInterval = async () => {
    const secNum = Number(intervalSeconds);
    if (!Number.isFinite(secNum) || secNum < 0) {
      setTimeMessage('请输入有效的出块间隔秒数（0 关闭自动挖矿）');
      return;
    }
    await submitTimeAction({ action: 'interval', seconds: secNum });
  };

  const handleReachTime = async () => {
    const tsNum = Number(reachTimestamp);
    if (!Number.isFinite(tsNum) || tsNum <= 0) {
      setTimeMessage('请输入有效的目标 Unix 时间戳（秒）');
      return;
    }
    await submitTimeAction({ action: 'reach', timestamp: tsNum });
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
          <div className="mt-3 flex gap-2">

            <div className="flex-1">
              <SaveStateButton 
                onSaved={fetchSavedStates}
                forkConfig={currentConfig ? {
                  rpcUrl: selectedRpcUrl || currentConfig.rpcUrl,
                  blockNumber: currentConfig.blockNumber,
                  chainId: currentConfig.networkId,
                  chainKey: selectedChain,
                } : undefined}
              />
            </div>
          </div>
        )}
      </div>

      {/* 配置表单 */}
      <div className="space-y-4">
        {/* 启动模式选择（仅在未启动时显示） */}
        {!isForking && (
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">启动模式</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!loadFromState}
                  onChange={() => setLoadFromState(false)}
                  disabled={loading}
                  className="mr-2"
                />
                <span className="text-gray-900">从区块链 Fork</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={loadFromState}
                  onChange={() => setLoadFromState(true)}
                  disabled={loading}
                  className="mr-2"
                />
                <span className="text-gray-900">从保存的状态加载</span>
              </label>
            </div>
          </div>
        )}

        {/* Anvil 运行时的状态管理 */}
        {isForking && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-900 mb-3">🔧 状态管理</h4>
            <div className="space-y-3">


              {/* 时间推进控制 */}
              <div className="mt-4 border-t border-green-200 text-gray-600 pt-3">
                <h5 className="text-xs font-semibold text-green-900 mb-2">⏱️ 时间推进</h5>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={fetchCurrentForkTime}
                    disabled={timeLoading}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs rounded"
                  >
                    {timeLoading ? '刷新中...' : '刷新当前时间'}
                  </button>
                  {currentForkTime && (
                    <span className="text-xs text-green-900">
                      区块 #{currentForkTime.blockNumber} · 时间 {new Date(currentForkTime.timestamp * 1000).toLocaleString('zh-CN')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={advanceSeconds}
                      onChange={(e) => setAdvanceSeconds(e.target.value)}
                      placeholder="增加秒数"
                      className="flex-1 px-3 py-2 border border-green-300 rounded bg-white text-sm"
                    />
                    <button
                      onClick={handleIncreaseTime}
                      disabled={timeLoading}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm rounded"
                    >
                      增加并出块
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={reachTimestamp}
                      onChange={(e) => setReachTimestamp(e.target.value)}
                      placeholder="推进到目标时间戳（秒）"
                      className="flex-1 px-3 py-2 border border-green-300 rounded bg-white text-sm"
                    />
                    <button
                      onClick={handleReachTime}
                      disabled={timeLoading}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm rounded"
                    >
                      推进到指定时间
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={nextTimestamp}
                      onChange={(e) => setNextTimestamp(e.target.value)}
                      placeholder="设置下个区块时间戳（秒）"
                      className="flex-1 px-3 py-2 border border-green-300 rounded bg-white text-sm"
                    />
                    <button
                      onClick={handleSetNextTimestamp}
                      disabled={timeLoading}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm rounded"
                    >
                      设置并出块
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={mineBlocks}
                      onChange={(e) => setMineBlocks(e.target.value)}
                      placeholder="出块数量"
                      className="flex-1 px-3 py-2 border border-green-300 rounded bg-white text-sm"
                    />
                    <button
                      onClick={handleMineBlocks}
                      disabled={timeLoading}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm rounded"
                    >
                      立即出块
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={intervalSeconds}
                      onChange={(e) => setIntervalSeconds(e.target.value)}
                      placeholder="自动出块间隔秒（0 关闭）"
                      className="flex-1 px-3 py-2 border border-green-300 rounded bg-white text-sm"
                    />
                    <button
                      onClick={handleSetInterval}
                      disabled={timeLoading}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm rounded"
                    >
                      设置间隔
                    </button>
                  </div>
                </div>
                {timeMessage && (
                  <p className="text-xs mt-2 text-green-800">{timeMessage}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 从保存的状态加载 - 选择状态（仅在未启动时显示） */}
        {!isForking && loadFromState && (
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              选择要加载的状态
            </label>
            <div className="flex gap-2">
              <select
                value={selectedState}
                onChange={(e) => handleStateSelect(e.target.value)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">-- 请选择 --</option>
                {savedStates.map((state) => (
                  <option key={state.name} value={state.name}>
                    {state.name} (保存于 {new Date(state.modifiedAt).toLocaleString('zh-CN')})
                    {state.forkConfig && ` - ${state.forkConfig.chainKey.toUpperCase()} #${state.forkConfig.blockNumber}`}
                  </option>
                ))}
              </select>
              {selectedState && (
                <button
                  onClick={() => handleDeleteState(selectedState)}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors whitespace-nowrap"
                  title="删除此状态"
                >
                  🗑️ 删除
                </button>
              )}
            </div>
            {savedStates.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">暂无保存的状态</p>
            )}
            <p className="text-xs text-green-600 mt-2">
              ✅ 选择状态后，fork 参数会自动填充（网络、RPC、区块号）。
            </p>
            <p className="text-xs text-gray-500 mt-1">
              说明：会先 fork 主网以保留所有合约（如交易池），然后再加载你保存的状态覆盖修改的部分。
            </p>
          </div>
        )}

        {/* 网络和RPC选择（仅在未启动时显示） */}
        {!isForking && (
          <>
            {/* 网络选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">选择网络</label>
            <select
              value={selectedChain}
              onChange={(e) => handleChainChange(e.target.value)}
              disabled={loading}
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
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {selectedChainInfo ? (
                selectedChainInfo.nodes && selectedChainInfo.nodes.length > 0 ? (
                  selectedChainInfo.nodes.map((node: any, index: number) => (
                    <option key={index} value={node.rpcUrl || node.rpc_url}>
                      {node.nodeName || node.node_name || 'RPC节点'}
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
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                onClick={handleGetLatestBlock}
                disabled={loading || fetchingLatestBlock || !selectedChain}
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
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-1">默认: 8545</p>
          </div>
          </>
        )}

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

        {/* 操作按钮 */}
        {!isForking ? (
          /* 启动 Fork 按钮 */
          <button
            onClick={handleFork}
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? '启动中...' : '启动Fork'}
          </button>
        ) : (
          /* 停止 Fork 按钮 */
          <button
            onClick={handleStopFork}
            disabled={loading}
            className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? '停止中...' : '🛑 停止Fork'}
          </button>
        )}
      </div>
    </div>
  );
}
