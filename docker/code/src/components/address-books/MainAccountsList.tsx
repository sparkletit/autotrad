'use client';

import React, { useState } from 'react';
import { deleteMainAccount } from '@/lib/addressBooksService';
import DerivedAccountsList from './DerivedAccountsList';
import SecretKeysModal from './SecretKeysModal';

interface MainAccount {
  id: number;
  account_name: string;
  address: string;
  mnemonic: string;
  private_key: string;
  created_at: string;
}

interface Props {
  accounts: MainAccount[];
  loading: boolean;
  onRefresh: () => void;
}

export default function MainAccountsList({ accounts, loading, onRefresh }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showSecretsModal, setShowSecretsModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<MainAccount | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const handleShowSecrets = (account: MainAccount) => {
    setSelectedAccount(account);
    setShowSecretsModal(true);
  };

  const handleCloseSecrets = () => {
    setShowSecretsModal(false);
    setSelectedAccount(null);
  };

  const handleDeleteMainAccount = async (accountId: number, accountName: string) => {
    if (!window.confirm(`确定要删除主账号 "${accountName}" 吗？\n删除后，该账号及其所有派生账号都将被移除，且无法恢复。`)) {
      return;
    }

    try {
      setDeleting(accountId);
      const { success, error } = await deleteMainAccount(accountId);
      if (success) {
        alert('主账号已删除');
        onRefresh();
      } else {
        alert(error || '删除失败，请稍后重试');
      }
    } catch (error) {
      alert('删除失败，请稍后重试');
      console.error('删除主账号失败:', error);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="text-6xl mb-4">💭</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">还没有创建主账号</h3>
        <p className="text-gray-600">点击上方"创建主账号"开始创建</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <div
          key={account.id}
          className="bg-white rounded-lg border border-gray-200 overflow-hidden"
        >
          {/* 主账号卡片 */}
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-gray-900">
                    {account.account_name}
                  </h3>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    主账号
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1 font-mono break-all">
                  {account.address}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleShowSecrets(account)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                  title="查看助记词和私钥"
                >
                  🔍
                </button>
                <button
                  onClick={() =>
                    setExpandedId(expandedId === account.id ? null : account.id)
                  }
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  {expandedId === account.id ? '▼ 隐藏' : '▶ 展开'}
                </button>
                <button
                  onClick={() => handleDeleteMainAccount(account.id, account.account_name)}
                  disabled={deleting === account.id}
                  className="px-3 py-1 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors disabled:opacity-50"
                  title="删除主账号及其所有派生账号"
                >
                  {deleting === account.id ? '删除中...' : '🗑️'}
                </button>
              </div>
            </div>
          </div>

          {/* 派生账号列表 */}
          {expandedId === account.id && (
            <div className="border-t border-gray-200 bg-gray-50 p-6">
              <DerivedAccountsList
                mainAccountId={account.id}
                onAccountCreated={onRefresh}
              />
            </div>
          )}
        </div>
      ))}

      {/* 秘密信息模态框 */}
      {showSecretsModal && selectedAccount && (
        <SecretKeysModal
          account={selectedAccount}
          onClose={handleCloseSecrets}
        />
      )}
    </div>
  );
}
