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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

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

  const handleSelectionChange = (id: number, selected: boolean) => {
    const newSelected = new Set(selectedIds);
    if (selected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === derivedAccounts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(derivedAccounts.map((a) => a.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      alert('请先选择要删除的派生账号');
      return;
    }

    if (!window.confirm(`确定要删除选中的 ${selectedIds.size} 个派生账号吗？`)) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(
        `/api/address-books/main-accounts/${mainAccountId}/derived-accounts/delete-batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountIds: Array.from(selectedIds),
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        alert(`已删除 ${selectedIds.size} 个派生账号`);
        setSelectedIds(new Set());
        fetchDerivedAccounts();
      } else {
        alert(data.error || '删除失败，请稍后重试');
      }
    } catch (error) {
      alert('删除失败，请稍后重试');
      console.error('批量删除派生账号失败:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {/* 派生账号列表头 */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-gray-900">派生账号</h4>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            + 派生新账号
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors"
            >
              {deleting ? `删除中... (${selectedIds.size})` : `删除选中 (${selectedIds.size})`}
            </button>
          )}
        </div>
      </div>

      {/* 全选复选框 */}
      {!loading && derivedAccounts.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedIds.size > 0 && selectedIds.size === derivedAccounts.length}
            onChange={handleSelectAll}
            className="w-5 h-5 cursor-pointer"
          />
          <span className="text-sm text-gray-600">
            {selectedIds.size > 0 ? `已选择 ${selectedIds.size} 个` : '全选'}
          </span>
        </div>
      )}

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
              mainAccountId={mainAccountId}
              onRefresh={fetchDerivedAccounts}
              isSelected={selectedIds.has(account.id)}
              onSelectionChange={handleSelectionChange}
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