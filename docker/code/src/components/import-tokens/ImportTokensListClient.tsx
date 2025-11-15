'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@/components/common/Alert';
import Modal from '@/components/common/Modal';
import Header from '@/components/Header';
import { useWalletBalanceQuery } from '@/hooks/useWalletBalanceQuery';
import { formatCurrency, formatTokenAmount, truncateAddress, formatSmallNumber } from '@/utils/tokenBalanceFormatters';

interface Token {
  id: number;
  chain: string;
  address: string;
  color: string;
  notes: string;
  balance?: string;
  pool?: string;
  created_at: string;
  updated_at: string;
}

interface FilterOptions {
  address: string;
  color: string;
  notes: string;
  chain: string;
}

const CHAIN_NAMES = {
  bsc: 'BSC',
  eth: 'ETH',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism'
};

const COLOR_OPTIONS = [
  { value: '', label: '无' }, // 添加"无"选项
  { value: 'red', label: '红色', class: 'bg-red-500' },
  { value: 'yellow', label: '黄色', class: 'bg-yellow-500' },
  { value: 'blue', label: '蓝色', class: 'bg-blue-500' },
  { value: 'green', label: '绿色', class: 'bg-green-500' },
  { value: 'purple', label: '紫色', class: 'bg-purple-500' }
];

const SCAN_URLS = {
  bsc: 'https://bscscan.com/address/',
  eth: 'https://etherscan.io/address/',
  ethereum: 'https://etherscan.io/address/',
  polygon: 'https://polygonscan.com/address/',
  arbitrum: 'https://arbiscan.io/address/',
  optimism: 'https://optimistic.etherscan.io/address/'
};

export default function ImportTokensListClient() {
  const router = useRouter();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTokens, setSelectedTokens] = useState<Set<number>>(new Set());
  const [editingNotes, setEditingNotes] = useState<{[key: number]: string}>({});
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [notesModal, setNotesModal] = useState<{ isOpen: boolean; tokenId: number; notes: string }>({ 
    isOpen: false, 
    tokenId: 0, 
    notes: '' 
  });
  const [poolsModal, setPoolsModal] = useState<{ 
    isOpen: boolean; 
    tokenId: number; 
    tokenAddress: string;
    tokenChain: string;
    pools: any[];
    summary: any;
    loading: boolean;
  }>({ 
    isOpen: false, 
    tokenId: 0, 
    tokenAddress: '',
    tokenChain: '',
    pools: [],
    summary: null,
    loading: false
  });
  const [filters, setFilters] = useState<FilterOptions>({
    address: '',
    color: '',
    notes: '',
    chain: ''
  });
  const [alertTimeout, setAlertTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25); // 默认25条
  const [paginatedTokens, setPaginatedTokens] = useState<Token[]>([]);

  // 钱包余额查询状态
  const [walletBalanceModal, setWalletBalanceModal] = useState<{
    isOpen: boolean;
    walletAddress: string;
    chain: string;
    totalUsdValue: number;
    tokenBalances: any[];
    loading: boolean;
    showTokenDetails: boolean;
  }>({
    isOpen: false,
    walletAddress: '',
    chain: '',
    totalUsdValue: 0,
    tokenBalances: [],
    loading: false,
    showTokenDetails: true
  });

  // 钱包余额数据映射（按链分组）
  const [walletBalances, setWalletBalances] = useState<{[key: string]: {totalUsdValue: number, tokenCount: number}}>({});

  // 钱包余额查询hook
  const { isLoading: walletBalanceLoading, error: walletBalanceError } = useWalletBalanceQuery();

  // 获取代币列表
  const fetchTokens = async () => {
    try {
      const response = await fetch('/api/import-tokens');
      const data = await response.json();
      
      if (response.ok) {
        setTokens(data.tokens.map((t: any) => ({ ...t, notes: t?.notes || '' })));
        
        // 处理已存储的余额数据
        if (data.tokens && data.tokens.length > 0) {
          const walletBalancesMap: {[key: string]: {totalUsdValue: number, tokenCount: number}} = {};
          
          data.tokens.forEach((token: any) => {
            if (token.totalUsdValue !== undefined) {
              const key = `${token.address}-${token.chain}`;
              walletBalancesMap[key] = {
                totalUsdValue: token.totalUsdValue,
                tokenCount: token.tokenCount || 0
              };
            }
          });
          
          // 更新钱包余额映射
          if (Object.keys(walletBalancesMap).length > 0) {
            setWalletBalances(walletBalancesMap);
          }
        }
      } else {
        setAlert({ type: 'error', message: data.error || '获取代币列表失败' });
      }
    } catch (error) {
      setAlert({ type: 'error', message: '网络错误，请重试' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  // 过滤功能
  useEffect(() => {
    let filtered = tokens;

    if (filters.address) {
      filtered = filtered.filter(token => 
        token.address.toLowerCase().includes(filters.address.toLowerCase())
      );
    }

    if (filters.color) {
      filtered = filtered.filter(token => token.color === filters.color);
    }

    if (filters.notes) {
      filtered = filtered.filter(token => 
        (token.notes || '').toLowerCase().includes(filters.notes.toLowerCase())
      );
    }

    if (filters.chain) {
      filtered = filtered.filter(token => token.chain === filters.chain);
    }

    setFilteredTokens(filtered);
    setCurrentPage(1); // 重置到第一页
  }, [tokens, filters]);

  // 分页功能
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedTokens(filteredTokens.slice(startIndex, endIndex));
  }, [filteredTokens, currentPage, itemsPerPage]);

  // 更新代币信息
  const updateToken = async (id: number, updates: Partial<Token>) => {
    try {
      console.log('准备更新代币:', { id, updates });
      
      const response = await fetch(`/api/import-tokens/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      console.log('更新响应:', { response, data });
      
      if (response.ok) {
        setTokens(tokens.map(token => 
          token.id === id ? { ...token, ...updates } : token
        ));
        setAutoCloseAlert('success', '更新成功');
        console.log('更新成功，本地状态已更新');
      } else {
        console.error('更新失败:', data);
        setAutoCloseAlert('error', data.error || '更新失败');
      }
    } catch (error) {
      console.error('网络错误:', error);
      setAutoCloseAlert('error', '网络错误，请重试');
    }
  };

  // 删除代币
  const deleteToken = async (id: number) => {
    if (!confirm('确定要删除这个代币地址吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/import-tokens/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTokens(tokens.filter(token => token.id !== id));
        setAutoCloseAlert('success', '删除成功');
      } else {
        const data = await response.json();
        setAutoCloseAlert('error', data.error || '删除失败');
      }
    } catch (error) {
      setAutoCloseAlert('error', '网络错误，请重试');
    }
  };

  // 批量删除
  const deleteSelected = async () => {
    if (selectedTokens.size === 0) {
      setAlert({ type: 'info', message: '请先选择要删除的代币' });
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedTokens.size} 个代币地址吗？`)) {
      return;
    }

    try {
      const response = await fetch('/api/import-tokens/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: Array.from(selectedTokens) }),
      });

      if (response.ok) {
        setTokens(tokens.filter(token => !selectedTokens.has(token.id)));
        setSelectedTokens(new Set());
        setAutoCloseAlert('success', `成功删除 ${selectedTokens.size} 个代币地址`);
      } else {
        const data = await response.json();
        setAutoCloseAlert('error', data.error || '批量删除失败');
      }
    } catch (error) {
      setAutoCloseAlert('error', '网络错误，请重试');
    }
  };

  const batchQueryWalletBalances = async () => {
    if (selectedTokens.size === 0) {
      setAlert({ type: 'info', message: '请先选择要查询余额的代币' });
      return;
    }
    setAutoCloseAlert('info', '正在批量查询余额...');
    const targets = tokens.filter(t => selectedTokens.has(t.id));
    const concurrency = 3;
    let index = 0;
    let successCount = 0;
    let failCount = 0;
    const runBatch = async () => {
      if (index >= targets.length) return;
      const slice = targets.slice(index, index + concurrency);
      index += concurrency;
      await Promise.allSettled(slice.map(async (token) => {
        try {
          const response = await fetch(`/api/balances/wallet-balance?walletAddress=${token.address}&chain=${token.chain}`);
          const data = await response.json();
          if (response.ok && data.success) {
            const { total_usd_value, token_count, tokens: tb } = data.data;
            const chainKey = `${token.address}-${token.chain}`;
            setWalletBalances(prev => ({
              ...prev,
              [chainKey]: { totalUsdValue: total_usd_value, tokenCount: token_count }
            }));
            if (tb && tb.length > 0) {
              const matchingTokenBalance = tb.find((x: any) => x.tokenAddress && x.tokenAddress.toLowerCase() === token.address.toLowerCase());
              if (matchingTokenBalance) {
                setTokens(prev => prev.map(t => t.id === token.id ? { ...t, balance: matchingTokenBalance.balanceEth } : t));
              }
            }
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }));
      await runBatch();
    };
    await runBatch();
    setAutoCloseAlert('success', `批量查询完成：成功 ${successCount} 个，失败 ${failCount} 个`);
  };

  // 复制地址到剪贴板
  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setAutoCloseAlert('success', '地址已复制到剪贴板');
    } catch (error) {
      setAutoCloseAlert('error', '复制失败，请手动复制');
    }
  };

  // 打开区块链浏览器
  const openScan = (chain: string, address: string) => {
    const scanUrl = SCAN_URLS[chain as keyof typeof SCAN_URLS];
    if (scanUrl) {
      window.open(`${scanUrl}${address}`, '_blank');
    } else {
      setAutoCloseAlert('error', '不支持该链的浏览器链接');
    }
  };

  // 处理全选
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTokens(new Set(paginatedTokens.map(token => token.id)));
    } else {
      setSelectedTokens(new Set());
    }
  };

  // 处理单个选择
  const handleSelectToken = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedTokens);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedTokens(newSelected);
  };

  // 打开备注编辑模态框
  const openNotesModal = (token: Token) => {
    setNotesModal({
      isOpen: true,
      tokenId: token.id,
      notes: token.notes || ''
    });
  };

  // 强制重新分析交易池（绕过缓存）
  const refreshPoolsAnalysis = async (token: Token) => {
    setAutoCloseAlert('info', '正在重新分析交易池...');
    
    try {
      // 调用API并添加刷新参数
      const response = await fetch(`/api/import-tokens/${token.id}/pools?refresh=true`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        const pools = data.data.pools || [];
        const summary = data.data.summary || null;
        const poolCountNum = typeof summary?.totalPools === 'number' ? summary.totalPools : Number(summary?.totalPools || 0);
        const prevCountNum = (() => { const n = Number(token.pool || 0); return Number.isFinite(n) ? n : 0; })();
        const nextCountNum = Math.max(prevCountNum, poolCountNum);
        const nextCountStr = String(nextCountNum);
        
        setTokens(prev => prev.map(t => 
          t.id === token.id ? { ...t, pool: nextCountStr } : t
        ));
        if (poolCountNum > 0 && poolCountNum >= prevCountNum) {
          updateToken(token.id, { pool: String(poolCountNum) });
        }
        
        
        setAutoCloseAlert('success', `交易池分析完成，找到 ${String(poolCountNum)} 个交易池`);
        
        // 自动打开模态框显示结果
        setPoolsModal({
          isOpen: true,
          tokenId: token.id,
          tokenAddress: token.address,
          tokenChain: token.chain,
          pools: pools,
          summary: summary,
          loading: false
        });
      } else {
        setAutoCloseAlert('error', data.error || '重新分析交易池失败');
      }
    } catch (error) {
      console.error('重新分析交易池失败:', error);
      setAutoCloseAlert('error', '网络错误，无法重新分析交易池');
    }
  };

  // 打开交易池详情模态框
  const openPoolsModal = async (token: Token) => {
    setPoolsModal({
      isOpen: true,
      tokenId: token.id,
      tokenAddress: token.address,
      tokenChain: token.chain,
      pools: [],
      summary: null,
      loading: true
    });

    try {
      const response = await fetch(`/api/import-tokens/${token.id}/pools`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        const pools = data.data.pools || [];
        const summary = data.data.summary || null;
        const isCached = data.data.cached || false;
        
        setPoolsModal(prev => ({
          ...prev,
          pools: pools,
          summary: summary,
          loading: false
        }));

        // 更新代币的交易池数量显示（仅在数据变化时累加、不回退）
        if (summary && typeof summary.totalPools === 'number' && summary.totalPools >= 0) {
          const currentCount = (() => { const n = Number(token.pool || 0); return Number.isFinite(n) ? n : 0; })();
          const nextCount = Math.max(currentCount, summary.totalPools);
          const nextCountStr = String(nextCount);
          if (token.pool !== nextCountStr) {
            setTokens(prev => prev.map(t => 
              t.id === token.id ? { ...t, pool: nextCountStr } : t
            ));
            if (!isCached && summary.totalPools >= currentCount) {
              updateToken(token.id, { pool: String(nextCount) });
            }
          }
        }
      } else {
        setAutoCloseAlert('error', data.error || '获取交易池信息失败');
        setPoolsModal(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('获取交易池信息失败:', error);
      setAutoCloseAlert('error', '网络错误，无法获取交易池信息');
      setPoolsModal(prev => ({ ...prev, loading: false }));
    }
  };

  // 查询钱包余额（所有代币）
  const handleQueryWalletBalance = async (token: Token) => {
    // 直接使用代币地址作为钱包地址
    const walletAddress = token.address;
    const chainKey = `${walletAddress}-${token.chain}`;

        setWalletBalanceModal({
          isOpen: true,
          walletAddress: walletAddress,
          chain: token.chain,
          totalUsdValue: 0,
          tokenBalances: [],
          loading: true,
          showTokenDetails: true
        });

    try {
      // 调用新的钱包余额API
      const response = await fetch(`/api/balances/wallet-balance?walletAddress=${walletAddress}&chain=${token.chain}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        const { total_usd_value, token_count, tokens } = data.data;
        
        setWalletBalanceModal(prev => ({
          ...prev,
          totalUsdValue: total_usd_value,
          tokenBalances: tokens,
          loading: false
        }));

        // 更新钱包余额映射
        setWalletBalances(prev => ({
          ...prev,
          [chainKey]: {
            totalUsdValue: total_usd_value,
            tokenCount: token_count
          }
        }));

        // 只更新当前点击的代币（避免误更新其他行的代币）
        if (tokens && tokens.length > 0) {
          // 只更新当前点击的代币（通过ID匹配，确保只更新当前行）
          const matchingTokenBalance = tokens.find((tb: any) => 
            tb.tokenAddress && tb.tokenAddress.toLowerCase() === token.address.toLowerCase()
          );
          
          if (matchingTokenBalance) {
            setTokens(prev => prev.map(t => {
              // 只更新当前点击的代币（通过ID匹配）
              if (t.id === token.id) {
                return { ...t, balance: matchingTokenBalance.balanceEth };
              }
              return t;
            }));
          }
        }
      } else {
        setAutoCloseAlert('error', data.error || '获取钱包余额信息失败');
        setWalletBalanceModal(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('获取钱包余额信息失败:', error);
      setAutoCloseAlert('error', '网络错误，无法获取钱包余额信息');
      setWalletBalanceModal(prev => ({ ...prev, loading: false }));
    }
  };

  // 保存备注
  const saveNotes = () => {
    // 清理HTML标签
    const cleanNotes = notesModal.notes.replace(/<[^>]*>/g, '');
    updateToken(notesModal.tokenId, { notes: cleanNotes });
    setNotesModal({ isOpen: false, tokenId: 0, notes: '' });
  };

  // 获取行背景颜色
  const getRowColorClass = (color: string) => {
    const colorMap: {[key: string]: string} = {
      red: 'bg-red-50 hover:bg-red-100',
      yellow: 'bg-yellow-50 hover:bg-yellow-100',
      blue: 'bg-blue-50 hover:bg-blue-100',
      green: 'bg-green-50 hover:bg-green-100',
      purple: 'bg-purple-50 hover:bg-purple-100'
    };
    return colorMap[color] || 'hover:bg-gray-50';
  };

  // 设置自动关闭的alert
  const setAutoCloseAlert = (type: 'success' | 'error' | 'info', message: string) => {
    // 清除之前的timeout
    if (alertTimeout) {
      clearTimeout(alertTimeout);
    }
    
    setAlert({ type, message });
    
    // 3秒后自动关闭
    const timeout = setTimeout(() => {
      setAlert(null);
    }, 3000);
    
    setAlertTimeout(timeout);
  };

  // 分页导航逻辑
  const totalPages = Math.ceil(filteredTokens.length / itemsPerPage);
  const pageNumbers = [];
  const maxVisiblePages = 5; // 最多显示5个页码
  
  if (totalPages <= maxVisiblePages) {
    // 如果总页数小于等于5，显示所有页码
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    // 如果总页数大于5，显示首页、当前页附近的页码、尾页
    pageNumbers.push(1); // 首页
    
    if (currentPage > 3) {
      pageNumbers.push('...');
    }
    
    // 当前页附近的页码
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    if (currentPage < totalPages - 2) {
      pageNumbers.push('...');
    }
    
    pageNumbers.push(totalPages); // 尾页
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="代币地址管理" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white shadow-lg rounded-lg p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-900">加载中...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header title="代币地址管理" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 过滤栏 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">筛选条件</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
                <input
                  type="text"
                  placeholder="输入地址关键词"
                  value={filters.address}
                  onChange={(e) => setFilters({ ...filters, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">区块链</label>
                <select
                  value={filters.chain}
                  onChange={(e) => setFilters({ ...filters, chain: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="">全部</option>
                  {Object.entries(CHAIN_NAMES).map(([key, name]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">颜色</label>
                <select
                  value={filters.color}
                  onChange={(e) => setFilters({ ...filters, color: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  {COLOR_OPTIONS.map((color) => (
                    <option key={color.value} value={color.value}>{color.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <input
                  type="text"
                  placeholder="输入备注关键词"
                  value={filters.notes}
                  onChange={(e) => setFilters({ ...filters, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                共找到 {filteredTokens.length} 个代币地址
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">每页显示:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={10}>10条</option>
                    <option value={25}>25条</option>
                    <option value={50}>50条</option>
                    <option value={100}>100条</option>
                  </select>
                </div>
                <button
                  onClick={batchQueryWalletBalances}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-white border border-blue-600 rounded-md hover:bg-blue-600 transition-colors"
                >
                  批量查询余额
                </button>
                <button
                  onClick={() => setFilters({ address: '', color: '', notes: '', chain: '' })}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  清除筛选
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 主要内容 */}
        <div className="bg-white shadow-lg rounded-lg">
          {alert && (
            <div className="px-6 pt-6">
              <Alert 
                type={alert.type} 
                message={alert.message} 
                onClose={() => {
                  setAlert(null);
                  if (alertTimeout) {
                    clearTimeout(alertTimeout);
                    setAlertTimeout(null);
                  }
                }} 
              />
            </div>
          )}

          {paginatedTokens.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无代币地址</h3>
              <p className="text-gray-600 mb-4">没有找到符合条件的代币地址</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => router.push('/import-tokens')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  开始导入
                </button>
                {totalPages > 1 && (
                  <button
                    onClick={() => {
                      setFilters({ address: '', color: '', notes: '', chain: '' });
                      setCurrentPage(1);
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    显示全部
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedTokens.size === paginatedTokens.length && paginatedTokens.length > 0}
                          onChange={handleSelectAll}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        序号
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        链
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider w-[380px]">
                        代币地址
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        颜色
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        余额
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        交易池
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        备注
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedTokens.map((token, index) => (
                      <tr key={token.id} className={getRowColorClass(token.color)}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedTokens.has(token.id)}
                            onChange={(e) => handleSelectToken(token.id, e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {token.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {CHAIN_NAMES[token.chain as keyof typeof CHAIN_NAMES] || token.chain.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-[380px] text-gray-900" title={token.address}>
                              {token.address}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => copyAddress(token.address)}
                                className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                                title="复制地址"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openScan(token.chain, token.address)}
                                className="p-1 text-blue-500 hover:text-blue-700 transition-colors"
                                title="查看区块链浏览器"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={token.color}
                            onChange={(e) => updateToken(token.id, { color: e.target.value })}
                            className="block w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                          >
                            {COLOR_OPTIONS.map((color) => (
                              <option key={color.value} value={color.value}>
                                {color.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                          {walletBalances[`${token.address}-${token.chain}`] ? (
                            <button
                              onClick={async () => {
                                const balanceData = walletBalances[`${token.address}-${token.chain}`];
                                
                                // 获取详细的代币数据
                                try {
                                  const response = await fetch(`/api/balances/wallet-balance?walletAddress=${token.address}&chain=${token.chain}`);
                                  const data = await response.json();
                                  
                                  if (response.ok && data.success) {
                                    setWalletBalanceModal({
                                      isOpen: true,
                                      walletAddress: token.address,
                                      chain: token.chain,
                                      totalUsdValue: data.data.total_usd_value,
                                      tokenBalances: data.data.tokens,
                                      loading: false,
                                      showTokenDetails: true
                                    });
                                  } else {
                                    // 如果API调用失败，使用缓存的余额数据但不显示代币详情
                                    setWalletBalanceModal({
                                      isOpen: true,
                                      walletAddress: token.address,
                                      chain: token.chain,
                                      totalUsdValue: balanceData.totalUsdValue,
                                      tokenBalances: [],
                                      loading: false,
                                      showTokenDetails: true
                                    });
                                  }
                                } catch (error) {
                                  console.error('获取详细余额失败:', error);
                                  // 使用缓存的余额数据但不显示代币详情
                                  setWalletBalanceModal({
                                    isOpen: true,
                                    walletAddress: token.address,
                                    chain: token.chain,
                                    totalUsdValue: balanceData.totalUsdValue,
                                    tokenBalances: [],
                                    loading: false,
                                    showTokenDetails: true
                                  });
                                }
                              }}
                              className="text-green-600 hover:text-green-800 font-medium underline"
                              title="点击查看详细余额信息"
                            >
                              {formatCurrency(walletBalances[`${token.address}-${token.chain}`].totalUsdValue)}
                            </button>
                          ) : (
                            token.balance || '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {token.pool && token.pool !== '-' ? (
                              <button
                                onClick={() => openPoolsModal(token)}
                                className="text-blue-600 hover:text-blue-800 font-medium underline"
                                title="点击查看交易池详情"
                              >
                                {token.pool}
                              </button>
                            ) : (
                              <button
                                onClick={() => openPoolsModal(token)}
                                className="text-gray-500 hover:text-blue-600 px-2 py-1 text-xs bg-gray-100 hover:bg-blue-50 rounded font-medium transition-colors"
                                title="点击分析交易池"
                              >
                                分析
                              </button>
                            )}
                            {token.pool && token.pool !== '-' && (
                              <button
                                onClick={() => refreshPoolsAnalysis(token)}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="重新分析交易池"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {token.notes ? (
                            <button
                              onClick={() => openNotesModal(token)}
                              className="inline-flex items-center p-1 text-gray-600 hover:text-blue-600"
                              title="查看并编辑备注"
                            >
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 113 3L8 19l-4 1 1-4 11.5-12.5z" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => openNotesModal(token)}
                              className="inline-flex items-center text-gray-400 hover:text-blue-600"
                              title="点击添加备注"
                            >
                              -
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleQueryWalletBalance(token)}
                              className="text-blue-600 hover:text-blue-800 px-2 py-1 text-xs bg-blue-50 rounded font-medium"
                            >
                              余额
                            </button>
                            <button
                              onClick={() => openPoolsModal(token)}
                              className="text-green-600 hover:text-green-800 px-2 py-1 text-xs bg-green-50 rounded font-medium"
                            >
                              交易池
                            </button>
                            <button
                              onClick={() => deleteToken(token.id)}
                              className="text-red-600 hover:text-red-800 px-2 py-1 text-xs bg-red-50 rounded font-medium"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* 分页导航 */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      显示第 {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredTokens.length)} 条，
                      共 {filteredTokens.length} 条记录
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        首页
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        上一页
                      </button>
                      
                      {/* 页码显示 */}
                      {pageNumbers.map((page, index) => (
                        <React.Fragment key={index}>
                          {page === '...' ? (
                            <span className="px-2 text-gray-500">...</span>
                          ) : (
                            <button
                              onClick={() => setCurrentPage(page as number)}
                              className={`px-3 py-1 text-sm border rounded ${
                                currentPage === page
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          )}
                        </React.Fragment>
                      ))}
                      
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        下一页
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        尾页
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 备注编辑模态框 */}
      <Modal
        isOpen={notesModal.isOpen}
        onClose={() => setNotesModal({ isOpen: false, tokenId: 0, notes: '' })}
        title="编辑备注"
        size="xl"
      >
        <div className="space-y-6 w-full">
          <div className="w-full">
            <label className="block text-lg font-medium text-gray-700 mb-3">
              备注内容
            </label>
            <textarea
              value={notesModal.notes}
              onChange={(e) => setNotesModal({ ...notesModal, notes: e.target.value })}
              rows={12}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              placeholder="请输入备注信息（不支持HTML代码）"
            />
            <p className="mt-2 text-sm text-gray-500">
              不支持HTML代码，输入的内容将被自动清理
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setNotesModal({ isOpen: false, tokenId: 0, notes: '' })}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={saveNotes}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </Modal>

      {/* 交易池详情模态框 */}
      <Modal
        isOpen={poolsModal.isOpen}
        onClose={() => setPoolsModal({ isOpen: false, tokenId: 0, tokenAddress: '', tokenChain: '', pools: [], summary: null, loading: false })}
        title="交易池详情"
        size="lg"
      >
        <div className="space-y-4">
          {poolsModal.loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">正在分析交易池...</p>
            </div>
          ) : poolsModal.pools.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-2">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">未找到交易池</h3>
              <p className="text-gray-600">该代币在主流 DEX 上暂无交易池</p>
            </div>
          ) : (
            <>
              {/* 汇总信息 */}
              {poolsModal.summary && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">汇总信息</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-blue-700 font-medium">总交易池数</div>
                      <div className="text-blue-900 text-lg font-semibold">{poolsModal.summary.totalPools}</div>
                    </div>
                    <div>
                      <div className="text-blue-700 font-medium">涉及链数</div>
                      <div className="text-blue-900">{poolsModal.summary.chains.length}</div>
                    </div>
                    <div>
                      <div className="text-blue-700 font-medium">DEX 数量</div>
                      <div className="text-blue-900">{poolsModal.summary.dexes.length}</div>
                    </div>
                    
                  </div>
                </div>
              )}

              {/* 交易池列表 */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">交易池详情</h4>
                {poolsModal.pools.map((pool, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {pool.token0Symbol}/{pool.token1Symbol}
                        </div>
                        <div className="text-sm text-gray-600">
                          {pool.dex} on {pool.chain.toUpperCase()}
                        </div>
                      </div>
                      
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">{pool.token0Symbol} 储备</div>
                        <div className="font-mono text-gray-900">
                          <div className="text-gray-900">
                            {Number(pool.reserve0).toLocaleString()}
                          </div>
                          <div className="text-green-600">
                            {(() => {
                              try {
                                const dec = typeof pool.token0Decimals === 'number' ? pool.token0Decimals : 18;
                                const etherInt = BigInt(pool.reserve0) / (BigInt(10) ** BigInt(dec));
                                const remainder = BigInt(pool.reserve0) % (BigInt(10) ** BigInt(dec));
                                if (remainder === BigInt(0)) return `${etherInt.toString()}`;
                                const remainderStr = remainder.toString().padStart(dec, '0').replace(/0+$/, '');
                                return `${etherInt.toString()}.${remainderStr}`;
                              } catch {
                                return '0';
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">{pool.token1Symbol} 储备</div>
                        <div className="font-mono text-gray-900">
                          <div className="text-gray-900">
                            {Number(pool.reserve1).toLocaleString()}
                          </div>
                          <div className="text-green-600">
                            {(() => {
                              try {
                                const dec = typeof pool.token1Decimals === 'number' ? pool.token1Decimals : 18;
                                const etherInt = BigInt(pool.reserve1) / (BigInt(10) ** BigInt(dec));
                                const remainder = BigInt(pool.reserve1) % (BigInt(10) ** BigInt(dec));
                                if (remainder === BigInt(0)) return `${etherInt.toString()}`;
                                const remainderStr = remainder.toString().padStart(dec, '0').replace(/0+$/, '');
                                return `${etherInt.toString()}.${remainderStr}`;
                              } catch {
                                return '0';
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500 font-mono flex items-center gap-2">
                          <span>交易对: {pool.pairAddress}</span>
                          <button
                            onClick={() => openScan(pool.chain, pool.pairAddress)}
                            className="p-1 text-blue-500 hover:text-blue-700 transition-colors"
                            title="查看区块链浏览器"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(pool.pairAddress);
                            setAutoCloseAlert('success', '交易对地址已复制');
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                        >
                          复制地址
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setPoolsModal({ isOpen: false, tokenId: 0, tokenAddress: '', tokenChain: '', pools: [], summary: null, loading: false })}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            关闭
          </button>
        </div>
      </Modal>

      {/* 钱包余额详情模态框 */}
      <Modal
        isOpen={walletBalanceModal.isOpen}
        onClose={() => setWalletBalanceModal({ isOpen: false, walletAddress: '', chain: '', totalUsdValue: 0, tokenBalances: [], loading: false, showTokenDetails: true })}
        title="钱包余额详情"
        size="large"
      >
        <div className="space-y-4">
          {walletBalanceModal.loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">正在查询钱包余额...</p>
            </div>
          ) : (
            <>
              {/* 钱包基本信息 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-3">钱包信息</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-blue-700 font-medium">钱包地址</div>
                    <div className="text-blue-900 font-mono">{truncateAddress(walletBalanceModal.walletAddress)}</div>
                  </div>
                  <div>
                    <div className="text-blue-700 font-medium">区块链</div>
                    <div className="text-blue-900">{walletBalanceModal.chain.toUpperCase()}</div>
                  </div>
                </div>
              </div>

              {/* 总资产价值 */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-3">总资产价值</h4>
                <div className="text-center">
                  {walletBalanceModal.tokenBalances && walletBalanceModal.tokenBalances.length > 0 ? (
                    <button
                      onClick={() => setWalletBalanceModal(prev => ({ ...prev, showTokenDetails: !prev.showTokenDetails }))}
                      className="text-3xl font-bold text-green-600 hover:text-green-800 underline cursor-pointer"
                      title={`${walletBalanceModal.showTokenDetails ? '隐藏' : '显示'}详细代币信息`}
                    >
                      {formatCurrency(walletBalanceModal.totalUsdValue)}
                    </button>
                  ) : (
                    <div className="text-3xl font-bold text-green-600">
                      {formatCurrency(walletBalanceModal.totalUsdValue)}
                    </div>
                  )}
                  <div className="text-sm text-green-700">USD</div>
                  {walletBalanceModal.tokenBalances && walletBalanceModal.tokenBalances.length > 0 && (
                    <div className="text-xs text-green-600 mt-1">
                      点击{walletBalanceModal.showTokenDetails ? '隐藏' : '显示'}详细代币信息
                    </div>
                  )}
                </div>
              </div>

              {/* 代币详情列表 */}
              {walletBalanceModal.tokenBalances && walletBalanceModal.tokenBalances.length > 0 && walletBalanceModal.showTokenDetails && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    代币详情 ({walletBalanceModal.tokenBalances.length} 种代币)
                  </h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {walletBalanceModal.tokenBalances.map((tokenBalance, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium text-gray-900">
                              {tokenBalance.name || tokenBalance.tokenName || 'Unknown Token'}
                            </div>
                            <div className="text-sm text-gray-600">
                              {tokenBalance.symbol || tokenBalance.tokenSymbol || 'Unknown'} - {truncateAddress(tokenBalance.tokenAddress)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-green-600">
                              {formatCurrency(tokenBalance.usdValue)}
                            </div>
                            <div className="text-sm text-gray-500">USD</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-gray-600">余额</div>
                            <div className="font-mono text-gray-900">
                              {tokenBalance.balanceEth}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600">单价</div>
                            <div className="font-mono text-gray-900">
                              {(() => {
                                const pRaw = tokenBalance.usdPrice ?? (
                                  tokenBalance.usdValue && tokenBalance.balanceEth
                                    ? (tokenBalance.usdValue / parseFloat(tokenBalance.balanceEth))
                                    : 0
                                );
                                const p = Number.isFinite(pRaw) ? pRaw : 0;
                                if (p === 0) return '$0';
                                if (p >= 0.01) return `$${p.toFixed(6)}`;
                                return `$${formatSmallNumber(p)}`;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 无代币时的提示 */}
              {(!walletBalanceModal.tokenBalances || walletBalanceModal.tokenBalances.length === 0) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-yellow-800">该钱包地址中暂无代币余额</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setWalletBalanceModal({ isOpen: false, walletAddress: '', chain: '', totalUsdValue: 0, tokenBalances: [], loading: false, showTokenDetails: true })}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            关闭
          </button>
        </div>
      </Modal>
    </div>
  );
}