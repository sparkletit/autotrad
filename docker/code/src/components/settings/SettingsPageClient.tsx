'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/settings/Sidebar';
import RPCNodeSettings from '@/components/settings/RPCNodeSettings';
import AddressAliasSettings from '@/components/settings/AddressAliasSettings';
import ForkNetworkConfig from '@/components/settings/ForkNetworkConfig';
import apiService from '@/lib/apiService';
import IdentityConfiguration from '@/components/settings/IdentityConfiguration';
import MintFunction from '@/components/settings/MintFunction';
import AccountAssets from '@/components/settings/AccountAssets';
import TokenManagement from '@/components/settings/TokenManagement';

export default function SettingsPageClient() {
  const [activeTab, setActiveTab] = useState('fork');
  const [isForking, setIsForking] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  // 标记组件已挂载到客户端，避免hydration mismatch
  useEffect(() => {
    setIsClient(true);
    // 从localStorage恢复之前选择的标签页
    const savedTab = localStorage.getItem('settingsActiveTab');
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  // 当activeTab变化时，保存到localStorage
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('settingsActiveTab', activeTab);
    }
  }, [activeTab, isClient]);

  // 页面挂载时初始化Fork状态
  useEffect(() => {
    fetchInitialForkState();
  }, []);

  // 当切换到identity标签时，重新检查Fork状态
  useEffect(() => {
    if (activeTab === 'identity') {
      fetchInitialForkState();
    }
  }, [activeTab]);

  const fetchInitialForkState = async () => {
    try {
      const { success, data } = await apiService.get('/api/fork/config');
      if (success && (data as any)?.isForking !== undefined) {
        setIsForking((data as any).isForking);
      }
    } catch (err) {
      console.error('获取Fork初始状态失败:', err);
    }
  };

  // 处理Fork状态更新（来自ForkNetworkConfig）
  const handleForkStateChange = (forkingState: boolean) => {
    setIsForking(forkingState);
  };

  const getTitleByTab = () => {
    const titles: Record<string, { title: string; desc: string }> = {
      fork: { title: 'Fork网络配置', desc: '配置和启动本地Fork网络进行测试' },
      identity: { title: '用户身份配置', desc: '自定义您的交易身份和偏好设置' },
      rpc: { title: 'RPC 节点配置', desc: '管理您的 RPC 节点连接' },
      address: { title: '交易池地址', desc: '管理您的交易池地址' },
      tokens: { title: '代币管理', desc: '管理自定义代币列表' },
    };
    return titles[activeTab] || titles.fork;
  };

  const { title, desc } = getTitleByTab();

  // 仅在客户端挂载后才渲染内容
  if (!isClient) {
    return null;
  }

  return (
    <>
      <Header />
      <div className="flex">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 p-8 pt-8 bg-white">
        <div className="max-w-6xl mx-auto">
          {/* 页面标题（仅客户端动态更新） */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            <p className="text-gray-600 mt-1">{desc}</p>
          </div>

          {/* 内容区域 */}
          <div className="space-y-6">
            {activeTab === 'fork' && (
              <ForkNetworkConfig
                onForkSuccess={() => setIsForking(true)}
                onForkStateChange={handleForkStateChange}
                isForking={isForking}
              />
            )}
            {activeTab === 'identity' && isClient && (
              <>
                <IdentityConfiguration
                  onAccountSelected={(account) => setSelectedAddress(account.address)}
                />
                {selectedAddress && (
                  <>
                    <MintFunction selectedAddress={selectedAddress} isForkActive={isForking} />
                   
                  </>
                )}
              </>
            )}
            {activeTab === 'rpc' && <RPCNodeSettings />}
            {activeTab === 'address' && <AddressAliasSettings />}
            {activeTab === 'tokens' && <TokenManagement />}
          </div>
        </div>
      </main>
      </div>
    </>
  );
}
