'use client';

import React, { useState } from 'react';

interface Props {
  mainAccountId: number;
  existingIndexes: number[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateDerivedAccountModal({
  mainAccountId,
  existingIndexes,
  onClose,
  onSuccess,
}: Props) {
  const [accountName, setAccountName] = useState('');
  const [derivationIndex, setDerivationIndex] = useState(0);
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

      const response = await fetch(
        `/api/address-books/main-accounts/${mainAccountId}/derived-accounts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountName: accountName.trim(),
            derivationIndex,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        alert('派生账号创建成功！');
        onSuccess();
      } else {
        setError(data.error || '创建失败，请稍后重试');
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
          <h3 className="text-lg font-bold text-gray-900">派生新账号</h3>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              派生索引
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={derivationIndex}
                onChange={(e) => setDerivationIndex(Math.max(0, parseInt(e.target.value) || 0))}
                min="0"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  let nextIndex = 0;
                  while (existingIndexes.includes(nextIndex)) {
                    nextIndex++;
                  }
                  setDerivationIndex(nextIndex);
                }}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm"
              >
                自动
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              派生路径：m/44'/60'/0'/0/{derivationIndex}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm text-blue-800">
            📄 派生账号使用不同的索引从同一助记词生成，共享相同的恢复密钥。
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
              className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium transition-colors"
            >
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}