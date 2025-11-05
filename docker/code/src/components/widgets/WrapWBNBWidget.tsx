'use client';

import React, { useState } from 'react';
import UnifiedAddressSelector from '@/components/common/UnifiedAddressSelector';

interface WrapWBNBWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const WrapWBNBWidget: React.FC<WrapWBNBWidgetProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedAddress, setSelectedAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleWrap = async () => {
    setError('');
    setSuccess('');

    if (!selectedAddress) {
      setError('请先选择要包装的地址');
      return;
    }

    if (!selectedAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('无效的账户地址格式，请选择有效的地址');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('请输入有效的BNB数量');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/swap/wrap-wbnb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: selectedAddress,
          amount,
          network: 'fork',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功将 ${amount} BNB 包装为 WBNB！`);
        setAmount('');
        setSelectedAddress('');
        setTimeout(() => {
          onClose();
          onSuccess?.();
        }, 1500);
      } else {
        setError(data.error || '包装失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '包装失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedAddress('');
    setAmount('');
    setError('');
    setSuccess('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 backdrop-blur-sm" onClick={handleClose} />
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 relative z-50">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">📦 包装 BNB 为 WBNB</h2>
        
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
            <label className="block text-sm font-medium text-gray-900 mb-2">选择账号</label>
            <UnifiedAddressSelector
              value={selectedAddress}
              onChange={setSelectedAddress}
              placeholder="搜索或选择账号..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">包装数量 (BNB)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="输入BNB数量"
                disabled={loading}
                step="0.01"
                min="0"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setAmount('1')}
                className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition-colors"
                disabled={loading}
              >
                1
              </button>
              <button
                onClick={() => setAmount('10')}
                className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition-colors"
                disabled={loading}
              >
                10
              </button>
              <button
                onClick={() => setAmount('100')}
                className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition-colors"
                disabled={loading}
              >
                100
              </button>
              <button
                onClick={() => setAmount('1000')}
                className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition-colors"
                disabled={loading}
              >
                1000
              </button>
              <button
                onClick={() => setAmount('10000')}
                className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition-colors"
                disabled={loading}
              >
                10000
              </button>
              <button
                onClick={() => setAmount('100000')}
                className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition-colors"
                disabled={loading}
              >
                100000
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleWrap}
            disabled={loading || !selectedAddress || !amount}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? '处理中...' : '确认包装'}
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

export default WrapWBNBWidget;
