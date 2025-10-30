'use client';

import React, { useState } from 'react';

const IdentitySettings: React.FC = () => {
  const [displayName, setDisplayName] = useState('加密货币交易者');
  const [selectedModel, setSelectedModel] = useState('保守型');
  const [selectedCurrency, setSelectedCurrency] = useState('USDT');
  const [addresses, setAddresses] = useState([
    { id: 1, chain: 'ETH', address: '0x74d...4f8e' },
    { id: 2, chain: 'BSC', address: '0x8f3a...2d9e' },
  ]);
  const [newAddress, setNewAddress] = useState('');

  const riskModels = ['保守型', '稳健型', '激进型'];
  const currencies = ['USDT', 'USDC', 'DAI', 'ETH'];

  const handleAddAddress = () => {
    if (newAddress.trim()) {
      setAddresses([
        ...addresses,
        { id: addresses.length + 1, chain: 'Ethereum', address: newAddress },
      ]);
      setNewAddress('');
    }
  };

  const handleDeleteAddress = (id: number) => {
    setAddresses(addresses.filter((addr) => addr.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* 身份设置 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-blue-600 font-bold">⊕</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900">身份设置</h2>
        </div>

        <div className="space-y-5">
          {/* 显示名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">显示名称</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              placeholder="输入您的交易身份名称"
            />
          </div>

          {/* 数值交易模式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">数值交易模式</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white"
            >
              {riskModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          {/* 首选货币 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">首选货币</label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white"
            >
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>

          {/* 自定义充值地址 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">自定义充值地址</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddAddress()}
                placeholder="输入充值地址"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              />
              <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-700 bg-white">
                <option>Ethereum</option>
                <option>Polygon</option>
                <option>BSC</option>
                <option>Arbitrum</option>
              </select>
              <button
                onClick={handleAddAddress}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <span>+</span> 添加
              </button>
            </div>
          </div>

          {/* 已配置充值地址 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">已配置充值地址</label>
            <div className="space-y-2">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div>
                    <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded mr-3">
                      {addr.chain}
                    </span>
                    <span className="text-gray-700 font-mono text-sm">{addr.address}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdentitySettings;
