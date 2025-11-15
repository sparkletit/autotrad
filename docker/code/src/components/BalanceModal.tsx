'use client';

import { useState } from 'react';
import { TokenBalance } from '@/hooks/useBalanceQuery';
import { formatCurrency, formatTokenAmount, truncateAddress } from '@/utils/balanceFormatters';

interface BalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  totalUsdValue: number;
  balances: TokenBalance[];
}

export default function BalanceModal({ isOpen, onClose, walletAddress, totalUsdValue, balances }: BalanceModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'name' | 'symbol'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  if (!isOpen) return null;

  // 过滤和排序余额
  const filteredBalances = balances
    .filter(balance => 
      balance.token_symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      balance.token_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue, bValue;
      switch (sortBy) {
        case 'value':
          aValue = a.usd_value;
          bValue = b.usd_value;
          break;
        case 'name':
          aValue = a.token_name.toLowerCase();
          bValue = b.token_name.toLowerCase();
          break;
        case 'symbol':
          aValue = a.token_symbol.toLowerCase();
          bValue = b.token_symbol.toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const handleSort = (newSortBy: 'value' | 'name' | 'symbol') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* 模态框头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-800">详细余额信息</h2>
            <p className="text-sm text-gray-600">
              钱包地址: {truncateAddress(walletAddress)}
            </p>
            <p className="text-sm text-gray-600">
              总USD价值: {formatCurrency(totalUsdValue)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 搜索和排序区域 */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="搜索代币名称或符号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSort('value')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === 'value' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                按价值 {sortBy === 'value' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => handleSort('symbol')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === 'symbol' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                按符号 {sortBy === 'symbol' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => handleSort('name')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === 'name' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                按名称 {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
            </div>
          </div>
        </div>

        {/* 余额列表 */}
        <div className="flex-1 overflow-y-auto max-h-[50vh]">
          {filteredBalances.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              <p>未找到匹配的代币</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredBalances.map((balance, index) => (
                <BalanceDetailItem key={`${balance.token_address}-${index}`} balance={balance} />
              ))}
            </div>
          )}
        </div>

        {/* 模态框底部 */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>共 {filteredBalances.length} 个代币</span>
            <span>总USD价值: {formatCurrency(totalUsdValue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BalanceDetailItemProps {
  balance: TokenBalance;
}

function BalanceDetailItem({ balance }: BalanceDetailItemProps) {
  const [showWei, setShowWei] = useState(false);
  const tokenAmount = formatTokenAmount(balance.balance_wei, balance.decimals);

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 代币图标 */}
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            {balance.logo_url ? (
              <img 
                src={balance.logo_url} 
                alt={balance.token_symbol}
                className="w-8 h-8 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold ${balance.logo_url ? 'hidden' : ''}`}>
              {balance.token_symbol.slice(0, 2).toUpperCase()}
            </div>
          </div>
          
          <div>
            <div className="font-semibold text-gray-800">{balance.token_symbol}</div>
            <div className="text-sm text-gray-600 truncate max-w-48">{balance.token_name}</div>
          </div>
        </div>

        <div className="text-right">
          <div className="font-semibold text-gray-800">
            {formatCurrency(balance.usd_value)}
          </div>
          <div 
            className="text-sm text-gray-600 cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => setShowWei(!showWei)}
            title="点击切换显示单位"
          >
            {showWei ? (
              <span>Wei: {balance.balance_wei}</span>
            ) : (
              <span>数量: {tokenAmount.ether}</span>
            )}
          </div>
        </div>
      </div>

      {/* 详细信息展开 */}
      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="font-medium">合约地址:</span> {truncateAddress(balance.token_address)}
          </div>
          <div>
            <span className="font-medium">精度:</span> {balance.decimals} 位
          </div>
          <div className="col-span-2">
            <span className="font-medium">Wei数量:</span> {balance.balance_wei}
          </div>
        </div>
      </div>
    </div>
  );
}