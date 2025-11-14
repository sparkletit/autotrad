'use client';

import React, { useState } from 'react';

interface TokenManagementWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TokenManagementWidget: React.FC<TokenManagementWidgetProps> = ({ isOpen, onClose, onSuccess }) => {
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState('18');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAddToken = async () => {
    setError('');
    setSuccess('');

    if (!tokenSymbol.trim()) {
      setError('请输入代币符号');
      return;
    }

    if (!tokenAddress.trim()) {
      setError('请输入代币地址');
      return;
    }

    if (!tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('无效的代币地址格式');
      return;
    }

    const decimals = parseInt(tokenDecimals);
    if (decimals < 0 || decimals > 255) {
      setError('精度必须在0-255之间');
      return;
    }

    setLoading(true);
    try {
      const { success, error } = await addToken({ symbol: tokenSymbol.toUpperCase(), address: tokenAddress, decimals });
      if (success) {
        setSuccess(`成功添加代币 ${tokenSymbol}！`);
        setTokenAddress('');
        setTokenSymbol('');
        setTokenDecimals('18');
        setTimeout(() => {
          onClose();
          onSuccess?.();
        }, 1500);
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
    setTokenAddress('');
    setTokenSymbol('');
    setTokenDecimals('18');
    setError('');
    setSuccess('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm" onClick={handleClose} />
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 relative z-50">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">🏪 代币管理</h2>
        
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
            <label className="block text-sm font-medium text-gray-900 mb-2">代币符号</label>
            <input
              type="text"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value)}
              placeholder="如：USDT"
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">代币地址</label>
            <input
              type="text"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="0x..."
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">精度 (Decimals)</label>
            <input
              type="number"
              value={tokenDecimals}
              onChange={(e) => setTokenDecimals(e.target.value)}
              min="0"
              max="255"
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleAddToken}
            disabled={loading || !tokenSymbol.trim() || !tokenAddress.trim()}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? '添加中...' : '确认添加'}
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

export default TokenManagementWidget;
import { addToken } from '@/lib/tokensService';
