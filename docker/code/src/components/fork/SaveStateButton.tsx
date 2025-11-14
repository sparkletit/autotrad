'use client';

import React, { useState } from 'react';
import apiService from '@/lib/apiService';

interface SaveStateButtonProps {
  onSaved?: () => void;
  forkConfig?: {
    rpcUrl: string;
    blockNumber: number;
    chainId: number;
    chainKey: string;
  };
}

const SaveStateButton: React.FC<SaveStateButtonProps> = ({ onSaved, forkConfig }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stateName, setStateName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      
      // 如果提供了 fork 配置，一起保存
      if (forkConfig) {
        requestBody.rpcUrl = forkConfig.rpcUrl;
        requestBody.blockNumber = forkConfig.blockNumber;
        requestBody.chainId = forkConfig.chainId;
        requestBody.chainKey = forkConfig.chainKey;
      }

      const { success, error } = await apiService.post('/api/fork/save-state', requestBody);
      if (success) {
        setSuccess(`状态已保存为 "${stateName}"${forkConfig ? '（含 fork 参数）' : ''}`);
        onSaved?.(); // 通知父组件刷新状态列表
        setTimeout(() => {
          setIsOpen(false);
          setStateName('');
          setSuccess('');
        }, 2000);
      } else {
        setError(error || '保存失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setStateName('');
    setError('');
    setSuccess('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
      >
        💾 保存网络状态
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 relative z-50">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          保存 Fork 网络状态
        </h3>

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
          />
          <p className="text-xs text-gray-500 mt-1">
            只能包含字母、数字、下划线和中划线
          </p>
        </div>

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
      </div>
    </div>
  );
};

export default SaveStateButton;
