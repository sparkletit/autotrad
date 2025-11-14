'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import MainAccountsList from '@/components/address-books/MainAccountsList';
import CreateMainAccountModal from '@/components/address-books/CreateMainAccountModal';

export default function AddressBooksClient() {
  const [mainAccounts, setMainAccounts] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // 标记组件已挂载到客户端，避免hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 获取主账号列表
  const fetchMainAccounts = async () => {
    try {
      setLoading(true);
      const { success, data } = await listMainAccounts();
      if (success) {
        setMainAccounts((data as any) || []);
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

  // 仅在客户端挂载后才渲染内容
  if (!isClient) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="地址本" />
      
      <main className="flex-1 p-8 pt-8">
        <div className="max-w-6xl mx-auto">
          {/* 页面标题 */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">地址本</h1>
              <p className="text-gray-600 mt-1">管理您的钱包账号和派生账号</p>
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
import { listMainAccounts } from '@/lib/addressBooksService';
