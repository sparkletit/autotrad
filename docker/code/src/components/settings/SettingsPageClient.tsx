'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/settings/Sidebar';
import RPCNodeSettings from '@/components/settings/RPCNodeSettings';
import AddressAliasSettings from '@/components/settings/AddressAliasSettings';
import ForkNetworkConfig from '@/components/settings/ForkNetworkConfig';
import IdentityConfiguration from '@/components/settings/IdentityConfiguration';
import MintFunction from '@/components/settings/MintFunction';
import AccountAssets from '@/components/settings/AccountAssets';

export default function SettingsPageClient() {
  const [activeTab, setActiveTab] = useState('fork');
  const [isForking, setIsForking] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string>('');

  // 页面挂载时初始化Fork状态
  useEffect(() => {
    document.title = '设置 - Web3 交易平台';
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
      const response = await fetch('/api/fork/config');
      const data = await response.json();
      if (data.success && data.isForking !== undefined) {
        setIsForking(data.isForking);
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
      address: { title: '地址别墅 & 别名', desc: '管理您的钱包地址别名' },
    };
    return titles[activeTab] || titles.fork;
  };

  const { title, desc } = getTitleByTab();

  return (
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
            {activeTab === 'fork' && (
              <ForkNetworkConfig
                onForkSuccess={() => setIsForking(true)}
                onForkStateChange={handleForkStateChange}
                isForking={isForking}
              />
            )}
            {activeTab === 'identity' && (
              <>
                <IdentityConfiguration
                  onAccountSelected={(account) => setSelectedAddress(account.address)}
                />
                {selectedAddress && (
                  <>
                    <MintFunction selectedAddress={selectedAddress} isForkActive={isForking} />
                    <AccountAssets address={selectedAddress} />
                  </>
                )}
              </>
            )}
            {activeTab === 'rpc' && <RPCNodeSettings />}
            {activeTab === 'address' && <AddressAliasSettings />}
          </div>
        </div>
      </main>
    </div>
  );
}
