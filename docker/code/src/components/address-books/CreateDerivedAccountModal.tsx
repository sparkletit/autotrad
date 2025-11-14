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
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(1);

  const handleCreate = async () => {
    if (isBatchMode) {
      await handleBatchCreate();
    } else {
      await handleSingleCreate();
    }
  };

  const handleSingleCreate = async () => {
    if (!accountName.trim()) {
      setError('账号名称不能为空');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const { success, error } = await createDerivedAccount(mainAccountId, { accountName: accountName.trim(), derivationIndex });
      if (success) {
        alert('派生账号创建成功！');
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

  const handleBatchCreate = async () => {
    if (!accountName.trim()) {
      setError('账号名称前缀不能为空');
      return;
    }

    if (batchCount <= 0 || batchCount > 100) {
      setError('创建个数需要为 1-100');
      return;
    }

    try {
      setLoading(true);
      setError('');

      let successCount = 0;
      let currentIndex = derivationIndex;
      const baseNamePrefix = accountName.trim();

      // 顺序创建派生账号
      for (let i = 0; i < batchCount; i++) {
        // 跳过已经存在的索引
        while (existingIndexes.includes(currentIndex)) {
          currentIndex++;
        }

        const { success } = await createDerivedAccount(mainAccountId, { accountName: `${baseNamePrefix} #${i + 1}`, derivationIndex: currentIndex });
        if (success) {
          successCount++;
          existingIndexes.push(currentIndex);
          currentIndex++;
        } else {
          console.error(`创建第 ${i + 1} 个派生账号失败`);
        }
      }

      if (successCount === batchCount) {
        alert(`成功创建了 ${successCount} 个派生账号！`);
        onSuccess();
      } else if (successCount > 0) {
        alert(`成功创建了 ${successCount} 个，失败 ${batchCount - successCount} 个`);
        onSuccess();
      } else {
        setError('创建失败，请稍后重试');
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
          <div className="flex gap-4 border-b pb-4">
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <input
                type="radio"
                checked={!isBatchMode}
                onChange={() => setIsBatchMode(false)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">单个创建</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <input
                type="radio"
                checked={isBatchMode}
                onChange={() => setIsBatchMode(true)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">批量创建</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isBatchMode ? '账号名称前缀' : '账号名称'}
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder={isBatchMode ? '比如：测试账号（最后会加上 #1, #2, ... 后缀）' : '输入账号名称'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isBatchMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                创建个数
              </label>
              <input
                type="number"
                value={batchCount}
                onChange={(e) => setBatchCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                min="1"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                将创建 {batchCount} 个账号，名称为：{accountName} #1, {accountName} #2, …
              </p>
            </div>
          )}

          {!isBatchMode && (
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
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm text-blue-800">
            {isBatchMode
              ? '🚀 批量创建账号擊晥事处理等场景非常有效，会一次性创建账号并自动级联（推荐）'
              : '📄 派生账号使用不同的索引从同一助记词生成，共享相同的恢复密钥。'}
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
              {loading ? (isBatchMode ? '创建中...' : '创建中...') : (isBatchMode ? `批量创建 (${batchCount})` : '创建')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
import { createDerivedAccount } from '@/lib/addressBooksService';
