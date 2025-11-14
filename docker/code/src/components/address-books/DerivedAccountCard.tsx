'use client';

import React, { useState } from 'react';
import SecretKeysModal from './SecretKeysModal';

interface DerivedAccount {
  id: number;
  account_name: string;
  address: string;
  private_key: string;
  derivation_path: string;
  index_num: number;
  created_at: string;
}

interface Props {
  account: DerivedAccount;
  mainAccountId: number;
  onRefresh: () => void;
  isSelected?: boolean;
  onSelectionChange?: (id: number, selected: boolean) => void;
}

export default function DerivedAccountCard({ account, mainAccountId, onRefresh, isSelected = false, onSelectionChange }: Props) {
  const [showSecrets, setShowSecrets] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剰贴板');
  };

  const handleDelete = async () => {
    if (!window.confirm(`确定要删除派生账号 "${account.account_name}" 吗？`)) {
      return;
    }

    try {
      setDeleting(true);
      const { success, error } = await deleteDerivedBatch(mainAccountId, [account.id]);
      if (success) {
        alert('派生账号已删除');
        onRefresh();
      } else {
        alert(error || '删除失败，请稍后重试');
      }
    } catch (error) {
      alert('删除失败，请稍后重试');
      console.error('删除派生账号失败:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className={`bg-white rounded-lg border ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} p-4 transition-colors`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 flex items-center gap-3">
            {onSelectionChange && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelectionChange(account.id, e.target.checked)}
                className="w-5 h-5 cursor-pointer"
              />
            )}
            <div>
              <h5 className="font-semibold text-gray-900">{account.account_name}</h5>
              <p className="text-xs text-gray-500 mt-1">
                派生路径: {account.derivation_path}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSecrets(true)}
              className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
              title="查看私钥"
            >
              🔍
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-1 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors disabled:opacity-50"
              title="删除派生账号"
            >
              {deleting ? '削...' : '🗑️'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="bg-gray-50 p-2 rounded text-xs break-all font-mono text-gray-900">
            {account.address}
          </div>
          <button
            onClick={() => handleCopy(account.address)}
            className="w-full py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded transition-colors"
          >
            📋 复制地址
          </button>
        </div>
      </div>

      {showSecrets && (
        <SecretKeysModal
          account={{
            account_name: account.account_name,
            address: account.address,
            private_key: account.private_key,
            mnemonic: '(派生账号无助记词)',
          } as any}
          isDerived
          onClose={() => setShowSecrets(false)}
        />
      )}
    </>
  );
}
import { deleteDerivedBatch } from '@/lib/addressBooksService';
