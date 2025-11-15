'use client';

import { useState } from 'react';
import { useBalanceQuery, TokenBalance } from '@/hooks/useBalanceQuery';
import { formatCurrency, formatTokenAmount, truncateAddress } from '@/utils/balanceFormatters';
import BalanceModal from './BalanceModal';

interface BalanceSummaryProps {
  walletAddress?: string;
  chain?: string;
}

export default function BalanceSummary({ walletAddress: initialWalletAddress, chain = 'bnb-mainnet' }: BalanceSummaryProps) {
  const [walletAddress, setWalletAddress] = useState(initialWalletAddress || '');
  const { balanceData, isLoading, error, queryBalance } = useBalanceQuery();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleQuery = async () => {
    if (!walletAddress.trim()) {
      return;
    }
    await queryBalance(walletAddress.trim(), chain);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuery();
    }
  };

  const openModal = () => {
    if (balanceData && balanceData.balances.length > 0) {
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">代币余额查询</h2>
        
        {/* 查询输入区域 */}
        <div className="mb-6">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="输入钱包地址 (例如: 0x6ca9e317b92c85a20f78a80442dcb76fb7077777)"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button
              onClick={handleQuery}
              disabled={isLoading || !walletAddress.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '查询中...' : '查询余额'}
            </button>
          </div>
          {error && (
            <div className="mt-2 text-red-600 text-sm">{error}</div>
          )}
        </div>

        {/* 余额汇总显示 */}
        {balanceData && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">余额汇总</h3>
                <p className="text-sm text-gray-600">
                  钱包地址: {truncateAddress(balanceData.walletAddress)}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-1">
                  {balanceData.cached ? '缓存数据' : '实时数据'}
                </div>
                <div className="text-xs text-gray-400">
                  更新于: {new Date(balanceData.lastUpdated).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(balanceData.totalUsdValue)}
                </div>
                <div className="text-sm text-gray-600">总USD价值</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {balanceData.tokenCount}
                </div>
                <div className="text-sm text-gray-600">代币数量</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-sm text-gray-600 mb-2">链</div>
                <div className="font-semibold">{chain}</div>
              </div>
            </div>

            {/* 点击查看详细余额 */}
            {balanceData.balances.length > 0 && (
              <div className="text-center">
                <button
                  onClick={openModal}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  查看详细余额
                </button>
              </div>
            )}
          </div>
        )}

        {/* 空状态 */}
        {!balanceData && !isLoading && !error && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <p className="text-gray-500">输入钱包地址开始查询代币余额</p>
          </div>
        )}
      </div>

      {/* 详细余额模态框 */}
      {balanceData && (
        <BalanceModal
          isOpen={isModalOpen}
          onClose={closeModal}
          walletAddress={balanceData.walletAddress}
          totalUsdValue={balanceData.totalUsdValue}
          balances={balanceData.balances}
        />
      )}
    </div>
  );
}