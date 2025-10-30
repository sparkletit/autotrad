'use client';

import React, { useState } from 'react';
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

  const handleShowSecrets = (account: MainAccount) => {
    setSelectedAccount(account);
    setShowSecretsModal(true);
  };

  const handleCloseSecrets = () => {
    setShowSecretsModal(false);
    setSelectedAccount(null);
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