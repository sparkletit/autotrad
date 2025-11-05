'use client';

import React, { useState, useEffect } from 'react';
import UnifiedAddressSelector from '@/components/common/UnifiedAddressSelector';

interface MintWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const MintWidget: React.FC<MintWidgetProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedAddress, setSelectedAddress] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleMint = async () => {
    setError('');
    setSuccess('');

    if (!selectedAddress) {
      setError('请先选择账号');
      return;
    }

    if (!mintAmount || parseFloat(mintAmount) <= 0) {
      setError('请输入有效的Mint数量');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/fork/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: selectedAddress,
          amount: mintAmount,
          token: 'BNB',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`成功Mint ${mintAmount} BNB！`);
        setMintAmount('');
        setSelectedAddress('');
        setTimeout(() => {
          onClose();
          onSuccess?.();
        }, 1500);
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

  const handleClose = () => {
    setMintAmount('');
    setSelectedAddress('');
    setError('');
    setSuccess('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="bg-black bg-opacity-50 absolute inset-0" onClick={handleClose} />
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 relative z-50">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">💰 Mint主网资产</h2>
        
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
            <label className="block text-sm font-medium text-gray-900 mb-2">Mint数量 (BNB)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                placeholder="输入BNB数量"
                disabled={loading}
                step="0.01"
                min="0"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setMintAmount('1000')}
                className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition-colors"
                disabled={loading}
              >
                1000
              </button>
              <button
                onClick={() => setMintAmount('10000')}
                className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition-colors"
                disabled={loading}
              >
                10000
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleMint}
            disabled={loading || !selectedAddress || !mintAmount}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? '处理中...' : '确认Mint'}
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

export default MintWidget;
