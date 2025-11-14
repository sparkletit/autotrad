'use client';

import React, { useState } from 'react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateMainAccountModal({ onClose, onSuccess }: Props) {
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!accountName.trim()) {
      setError('账号名称不能为空');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const { success, error } = await apiService.post('/api/address-books/main-accounts', { accountName: accountName.trim() });
      if (success) {
        alert('主账号创建成功！请妥善保存助记词和私钥。');
        onSuccess();
      } else {
        setError(error || '创建失败，请稍后重试');
      }
    } catch (err) {
      setError('创建失败，请稍后重试');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900">创建主账号</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              账号名称
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="输入账号名称"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm text-blue-800">
            📄 创建后会生成新的助记词。请妥善保管，丢失助记词将无法恢复账号。
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
            >
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
import apiService from '@/lib/apiService';
