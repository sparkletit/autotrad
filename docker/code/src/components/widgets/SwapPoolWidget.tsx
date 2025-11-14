'use client';

import React, { useState } from 'react';

interface SwapPoolWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SwapPoolWidget: React.FC<SwapPoolWidgetProps> = ({ isOpen, onClose, onSuccess }) => {
  const [poolName, setPoolName] = useState('');
  const [poolAddress, setPoolAddress] = useState('');
  const [network, setNetwork] = useState('fork');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const networks = [
    { id: 'fork', name: 'Fork 网络' },
    { id: 'ethereum', name: 'Ethereum' },
    { id: 'bsc', name: 'BSC' },
    { id: 'polygon', name: 'Polygon' },
  ];

  const handleAddPool = async () => {
    setError('');
    setSuccess('');

    if (!poolName.trim()) {
      setError('请输入交易池名称');
      return;
    }

    if (!poolAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('请输入有效的交易池地址');
      return;
    }

    setLoading(true);
    try {
      const { success, error } = await apiService.post('/api/address-aliases', { alias: poolName.trim(), address: poolAddress, network, type: 'pool' });
      if (success) {
        setSuccess(`成功添加交易池 "${poolName}"`);
        setPoolName('');
        setPoolAddress('');
        setNetwork('fork');
        setTimeout(() => {
          onClose();
          onSuccess?.();
        }, 1000);
      } else {
        setError(error || '添加失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPoolName('');
    setPoolAddress('');
    setNetwork('fork');
    setError('');
    setSuccess('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm" onClick={handleClose} />
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 relative z-50">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">🔄 添加交易池</h2>
        
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

        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">交易池名称</label>
            <input
              type="text"
              value={poolName}
              onChange={(e) => setPoolName(e.target.value)}
              placeholder="例如：BNB-USDT"
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">网络</label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {networks.map((net) => (
                <option key={net.id} value={net.id}>
                  {net.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">交易池地址</label>
            <input
              type="text"
              value={poolAddress}
              onChange={(e) => setPoolAddress(e.target.value)}
              placeholder="0x..."
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleAddPool}
            disabled={loading || !poolName.trim() || !poolAddress}
            className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? '添加中...' : '确认'}
          </button>
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold rounded-lg transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwapPoolWidget;
import apiService from '@/lib/apiService';
