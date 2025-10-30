'use client';
'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import MainAccountsList from '@/components/address-books/MainAccountsList';
import CreateMainAccountModal from '@/components/address-books/CreateMainAccountModal';

export default function AddressBooksPage() {
  const [mainAccounts, setMainAccounts] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // 获取主账号列表
  const fetchMainAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/address-books/main-accounts');
      const data = await response.json();
      
      if (data.success) {
        setMainAccounts(data.data);
      }
    } catch (error) {
      console.error('获取账号列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMainAccounts();
  }, []);

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    fetchMainAccounts();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="flex-1 p-8 pt-8">
        <div className="max-w-6xl mx-auto">
          {/* 页面标题 */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">地址本</h1>
              <p className="text-gray-600 mt-1">管理您的钙包账号和派生账号</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              + 创建主账号
            </button>
          </div>

          {/* 主账号列表 */}
          <MainAccountsList
            accounts={mainAccounts}
            loading={loading}
            onRefresh={fetchMainAccounts}
          />
        </div>
      </main>

      {/* 创建主账号模态框 */}
      {showCreateModal && (
        <CreateMainAccountModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}