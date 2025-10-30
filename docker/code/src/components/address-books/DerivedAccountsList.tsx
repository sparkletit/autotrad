'use client';

import React, { useState, useEffect } from 'react';
import CreateDerivedAccountModal from './CreateDerivedAccountModal';
import DerivedAccountCard from './DerivedAccountCard';

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
  mainAccountId: number;
  onAccountCreated: () => void;
}

export default function DerivedAccountsList({
  mainAccountId,
  onAccountCreated,
}: Props) {
  const [derivedAccounts, setDerivedAccounts] = useState<DerivedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 获取派生账号列表
  const fetchDerivedAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/address-books/main-accounts/${mainAccountId}/derived-accounts`
      );
      const data = await response.json();

      if (data.success) {
        setDerivedAccounts(data.data);
      }
    } catch (error) {
      console.error('获取派生账号失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDerivedAccounts();
  }, [mainAccountId]);

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    fetchDerivedAccounts();
    onAccountCreated();
  };

  return (
    <div>
      {/* 派生账号列表头 */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-gray-900">派生账号</h4>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          + 派生新账号
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : derivedAccounts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          还没有派生账号，点击"派生新账号"创建
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {derivedAccounts.map((account) => (
            <DerivedAccountCard
              key={account.id}
              account={account}
              onRefresh={fetchDerivedAccounts}
            />
          ))}
        </div>
      )}

      {/* 创建派生账号模态框 */}
      {showCreateModal && (
        <CreateDerivedAccountModal
          mainAccountId={mainAccountId}
          existingIndexes={derivedAccounts.map((a) => a.index_num)}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}