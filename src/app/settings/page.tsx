'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/settings/Sidebar';
import IdentitySettings from '@/components/settings/IdentitySettings';
import RPCNodeSettings from '@/components/settings/RPCNodeSettings';
import AddressAliasSettings from '@/components/settings/AddressAliasSettings';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('identity');

  const getTitleByTab = () => {
    const titles: Record<string, { title: string; desc: string }> = {
      identity: { title: '用户身份配置', desc: '自定义您的交易身份和偏好设置' },
      rpc: { title: 'RPC 节点配置', desc: '管理您的 RPC 节点连接' },
      address: { title: '交易池地址', desc: '管理您的交易池地址' },
    };
    return titles[activeTab] || titles.identity;
  };

  const { title, desc } = getTitleByTab();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main className="flex-1 p-8 pt-8 bg-white">
          <div className="max-w-6xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
              <p className="text-gray-600 mt-1">{desc}</p>
            </div>

            {/* 内容区域 */}
            <div className="space-y-6">
              {activeTab === 'identity' && <IdentitySettings />}
              {activeTab === 'rpc' && <RPCNodeSettings />}
              {activeTab === 'address' && <AddressAliasSettings />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
