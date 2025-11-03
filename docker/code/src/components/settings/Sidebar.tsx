'use client';

import React, { useState } from 'react';
import { ImportWalletModal, MintModal, WrapModal } from './modals';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [showWrapModal, setShowWrapModal] = useState(false);

  const configMenuItems = [
    { id: 'fork', label: 'Fork网络', icon: '🔀' },
    { id: 'identity', label: '用户身份', icon: '👤' },
    { id: 'rpc', label: 'RPC 节点', icon: '🔗' },
    { id: 'address', label: '交易池地址', icon: '📍' },
  ];

  const quickActions = [
    { id: 'import-wallet', label: '添加钱包', icon: '➕' },
    { id: 'mint-bnb', label: 'Mint主网资产', icon: '💰' },
    { id: 'wrap-wbnb', label: '包装WBNB', icon: '💶' },
  ];

  const handleQuickAction = (actionId: string) => {
    switch (actionId) {
      case 'import-wallet':
        setShowImportModal(true);
        break;
      case 'mint-bnb':
        setShowMintModal(true);
        break;
      case 'wrap-wbnb':
        setShowWrapModal(true);
        break;
    }
  };

  return (
    <>
      <aside className="w-56 bg-white border-r border-gray-200 min-h-screen sticky top-16">
        <div className="p-6">
          {/* 配置选项 */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wider">
              配置选项
            </h3>
            <nav className="space-y-2">
              {configMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* 快速操作 */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wider">
              快速操作
            </h3>
            <nav className="space-y-2">
              {quickActions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleQuickAction(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </aside>

      {/* 模态框 */}
      <ImportWalletModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} />
      <MintModal isOpen={showMintModal} onClose={() => setShowMintModal(false)} />
      <WrapModal isOpen={showWrapModal} onClose={() => setShowWrapModal(false)} />
    </>
  );
};

export default Sidebar;