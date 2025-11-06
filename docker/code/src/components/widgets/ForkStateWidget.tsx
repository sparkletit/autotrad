'use client';

import React, { useState, useEffect } from 'react';

interface ForkStateWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ForkStateWidget: React.FC<ForkStateWidgetProps> = ({ isOpen, onClose, onSuccess }) => {
  const [stateName, setStateName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isForkRunning, setIsForkRunning] = useState(false);
  const [forkConfig, setForkConfig] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      checkForkStatus();
    }
  }, [isOpen]);

  const checkForkStatus = async () => {
    try {
      const response = await fetch('/api/fork/status');
      const data = await response.json();
      setIsForkRunning(data.isRunning || false);
      
      if (data.isRunning) {
        // 从状态 API 获取 fork 信息（包含更完整的配置）
        // status API 返回的 config 字段包含完整的 fork 配置
        let forkConfigData = null;
        
        if (data.config) {
          // 如果 status API 返回了 config，使用它
          forkConfigData = data.config;
        } else {
          // 否则从配置 API 获取
          const configResponse = await fetch('/api/fork/config');
          const configData = await configResponse.json();
          
          if (configData.success && configData.currentConfig) {
            forkConfigData = configData.currentConfig;
          }
        }
        
        console.log('🔍 获取到的 fork 配置:', forkConfigData);
        
        // 尝试从已保存的状态中查找对应的配置
        // 如果当前运行的 fork 对应某个已保存的状态，从数据库获取参数
        if (forkConfigData) {
          // 构建 fork 配置对象
          // 注意：需要从 chains 中获取 chainKey，或者从数据库的 fork_states 表查找
          const configToSave = {
            rpcUrl: forkConfigData.rpcUrl || '',
            blockNumber: forkConfigData.blockNumber || data.blockNumber || 0,
            chainId: forkConfigData.chainId || data.chainId || 56,
            chainKey: forkConfigData.chainKey || '', // 这个可能为空，需要从 chains 获取
          };
          
          // 如果缺少 chainKey，尝试从 chains 中查找
          if (!configToSave.chainKey && configToSave.chainId) {
            const configResponse = await fetch('/api/fork/config');
            const configData = await configResponse.json();
            if (configData.success && configData.chains) {
              const matchingChain = configData.chains.find(
                (chain: any) => chain.id === configToSave.chainId
              );
              if (matchingChain) {
                configToSave.chainKey = matchingChain.key;
              }
            }
          }
          
          // 检查是否所有必需参数都存在
          // 注意：chainKey 不是必需的，后端会通过 rpcUrl 自动查找
          if (configToSave.rpcUrl && configToSave.blockNumber !== undefined && configToSave.chainId !== undefined) {
            setForkConfig(configToSave);
            console.log('✅ 获取到 fork 配置（后端会自动补充 chainKey）:', configToSave);
          } else {
            console.warn('⚠️ Fork 配置不完整，缺少参数:', configToSave);
            setForkConfig(null);
          }
        } else {
          console.warn('⚠️ 无法获取 fork 配置');
          setForkConfig(null);
        }
      }
    } catch (err) {
      console.error('检查 Fork 状态失败:', err);
      setIsForkRunning(false);
    }
  };

  const handleSave = async () => {
    if (!stateName.trim()) {
      setError('请输入状态名称');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(stateName)) {
      setError('状态名称只能包含字母、数字、下划线和中划线');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const requestBody: any = { stateName };
      
      // 如果有 fork 配置，一起保存
      if (forkConfig) {
        requestBody.rpcUrl = forkConfig.rpcUrl;
        requestBody.blockNumber = forkConfig.blockNumber;
        requestBody.chainId = forkConfig.chainId;
        requestBody.chainKey = forkConfig.chainKey;
      }

      const response = await fetch('/api/fork/save-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message || `状态已保存为 "${stateName}"`);
        setStateName('');
        onSuccess?.();
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      } else {
        setError(data.error || '保存失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStateName('');
    setError('');
    setSuccess('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900">
            💾 保存 Fork 网络状态
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {!isForkRunning ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded mb-4">
            <p className="text-sm text-yellow-800">
              ⚠️ Fork 网络未运行，请先启动 Fork 网络后再保存状态。
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              保存当前网络的所有账户余额、合约状态等信息，下次可以直接加载此状态快速启动。
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                状态名称 *
              </label>
              <input
                type="text"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                placeholder="例如: test-state-1"
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handleSave();
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                只能包含字母、数字、下划线和中划线
              </p>
            </div>

            {forkConfig ? (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium mb-1">✅ 将保存完整配置</p>
                <p className="text-xs text-green-700">
                  包含 fork 参数: {forkConfig.chainKey} (区块 {forkConfig.blockNumber})
                </p>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium mb-1">⚠️ 仅保存账户状态</p>
                <p className="text-xs text-yellow-700">
                  未检测到 fork 配置信息。将只保存当前账户状态，不包含 fork 参数。
                  从设置页启动 fork 后保存将包含完整配置。
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={loading || !stateName.trim()}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? '保存中...' : '确认保存'}
              </button>
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ForkStateWidget;

