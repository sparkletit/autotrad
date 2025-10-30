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
  onRefresh: () => void;
}

export default function DerivedAccountCard({ account, onRefresh }: Props) {
  const [showSecrets, setShowSecrets] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剩贴板');
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h5 className="font-semibold text-gray-900">{account.account_name}</h5>
            <p className="text-xs text-gray-500 mt-1">
              派生路径: {account.derivation_path}
            </p>
          </div>
          <button
            onClick={() => setShowSecrets(true)}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
            title="查看私钥"
          >
            🔍
          </button>
        </div>

        <div className="space-y-2">
          <div className="bg-gray-50 p-2 rounded text-xs break-all font-mono">
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