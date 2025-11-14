'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Account {
  id: number;
  account_name: string;
  address: string;
  type: 'main' | 'derived';
}

interface AddressAlias {
  id: number;
  alias: string;
  address: string;
}

interface CustomToken {
  id: number;
  symbol: string;
  address: string;
  decimals: number;
}

interface UnifiedAddressSelectorProps {
  value: string;
  onChange: (address: string, label?: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

type TabType = 'accounts' | 'aliases' | 'tokens' | 'custom';

/**
 * 统一地址选择下拉框组件
 * 打开时显示四个标签页：地址本、交易池、代币、自定义地址
 * 用户在标签页之间自由切换选择
 */
const UnifiedAddressSelector: React.FC<UnifiedAddressSelectorProps> = ({
  value,
  onChange,
  placeholder = '搜索或选择地址...',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('accounts');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [customAddress, setCustomAddress] = useState('');

  // 标签页数据
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [aliases, setAliases] = useState<AddressAlias[]>([]);
  const [tokens, setTokens] = useState<CustomToken[]>([]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 获取账户列表
  const fetchAccounts = async () => {
    if (accounts.length > 0) return;
    setLoading(true);
    try {
      const { success, data } = await listMainAccounts();
      if (success) {
        const mainAccounts: Account[] = ((data as any) || []).map((acc: any) => ({
          id: acc.id,
          account_name: acc.account_name,
          address: acc.address,
          type: 'main' as const,
        }));

        const allAccounts: Account[] = [...mainAccounts];

        for (const mainAccount of mainAccounts) {
          try {
            const { success: dSucc, data: dData } = await listDerivedAccounts(mainAccount.id);
            if (dSucc) {
              const derived = ((dData as any) || []).map((acc: any) => ({
                id: acc.id,
                account_name: acc.account_name,
                address: acc.address,
                type: 'derived' as const,
              }));
              allAccounts.push(...derived);
            }
          } catch (err) {
            console.error('获取派生账号失败:', err);
          }
        }

        setAccounts(allAccounts);
      }
    } catch (err) {
      console.error('获取账户列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 获取地址别名列表
  const fetchAliases = async () => {
    if (aliases.length > 0) return;
    setLoading(true);
    try {
      const { success, data } = await listAliases();
      if (success) {
        setAliases(((data as any) || []));
      }
    } catch (err) {
      console.error('获取地址别名失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 获取代币列表
  const fetchTokens = async () => {
    if (tokens.length > 0) return;
    setLoading(true);
    try {
      const { success, data } = await listTokens();
      if (success) {
        setTokens(((data as any) || []));
      }
    } catch (err) {
      console.error('获取代币列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 打开下拉框时加载所有数据
  const handleOpen = () => {
    setIsOpen(true);
    if (accounts.length === 0) fetchAccounts();
    if (aliases.length === 0) fetchAliases();
    if (tokens.length === 0) fetchTokens();
  };

  // 切换标签页
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchText('');
    if (tab === 'custom') {
      // 如果当前值是自定义地址（不在其他标签页中），显示在输入框中
      if (value && 
          value.match(/^0x[a-fA-F0-9]{40}$/) &&
          !accounts.find(a => a.address.toLowerCase() === value.toLowerCase()) &&
          !aliases.find(a => a.address.toLowerCase() === value.toLowerCase()) &&
          !tokens.find(t => t.address.toLowerCase() === value.toLowerCase())) {
        setCustomAddress(value);
      } else {
        setCustomAddress('');
      }
    }
    if (tab === 'accounts' && accounts.length === 0) fetchAccounts();
    else if (tab === 'aliases' && aliases.length === 0) fetchAliases();
    else if (tab === 'tokens' && tokens.length === 0) fetchTokens();
  };

  // 过滤数据
  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.account_name.toLowerCase().includes(searchText.toLowerCase()) ||
      acc.address.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredAliases = aliases.filter(
    (alias) =>
      alias.alias.toLowerCase().includes(searchText.toLowerCase()) ||
      alias.address.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredTokens = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(searchText.toLowerCase()) ||
      token.address.toLowerCase().includes(searchText.toLowerCase())
  );

  // 获取显示标签
  useEffect(() => {
    if (value) {
      const accountMatch = accounts.find((a) => a.address.toLowerCase() === value.toLowerCase());
      if (accountMatch) {
        setSelectedLabel(
          `${accountMatch.account_name.toUpperCase()} (${accountMatch.address.slice(0, 6)}...${accountMatch.address.slice(-4)})`
        );
        return;
      }

      const aliasMatch = aliases.find((a) => a.address.toLowerCase() === value.toLowerCase());
      if (aliasMatch) {
        setSelectedLabel(`${aliasMatch.alias} (${aliasMatch.address.slice(0, 6)}...${aliasMatch.address.slice(-4)})`);
        return;
      }

      const tokenMatch = tokens.find((t) => t.address.toLowerCase() === value.toLowerCase());
      if (tokenMatch) {
        setSelectedLabel(`${tokenMatch.symbol} (${tokenMatch.address.slice(0, 6)}...${tokenMatch.address.slice(-4)})`);
        return;
      }

      if (value.match(/^0x[a-fA-F0-9]{40}$/)) {
        setSelectedLabel(`${value.slice(0, 6)}...${value.slice(-4)}`);
      }
    } else {
      setSelectedLabel('');
    }
  }, [value, accounts, aliases, tokens]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 标签页配置
  const tabConfig = {
    accounts: { label: '地址本', icon: '👤', count: accounts.length },
    aliases: { label: '交易池', icon: '🔄', count: aliases.length },
    tokens: { label: '代币', icon: '💎', count: tokens.length },
    custom: { label: '自定义', icon: '✏️', count: 0 },
  };

  // 处理自定义地址输入
  const handleCustomAddressSubmit = () => {
    const trimmedAddress = customAddress.trim();
    if (!trimmedAddress) {
      return;
    }
    
    // 验证地址格式
    if (!trimmedAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      alert('无效的以太坊地址格式（应以0x开头，长度为42）');
      return;
    }
    
    onChange(trimmedAddress, '自定义地址');
    setIsOpen(false);
    setCustomAddress('');
    setSearchText('');
  };

  // 渲染选项列表
  const renderOptions = () => {
    // 自定义地址标签页
    if (activeTab === 'custom') {
      return (
        <div className="p-4">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              输入自定义地址
            </label>
            <input
              type="text"
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCustomAddressSubmit();
                }
              }}
              placeholder="0x..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              请输入有效的以太坊地址（以0x开头，长度为42）
            </p>
          </div>
          <button
            onClick={handleCustomAddressSubmit}
            disabled={!customAddress.trim() || !customAddress.trim().match(/^0x[a-fA-F0-9]{40}$/)}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            确认使用
          </button>
          {value && value.match(/^0x[a-fA-F0-9]{40}$/) && 
           !accounts.find(a => a.address.toLowerCase() === value.toLowerCase()) &&
           !aliases.find(a => a.address.toLowerCase() === value.toLowerCase()) &&
           !tokens.find(t => t.address.toLowerCase() === value.toLowerCase()) && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800 font-semibold mb-1">当前使用的自定义地址：</p>
              <p className="text-xs font-mono text-blue-900 break-all">{value}</p>
            </div>
          )}
        </div>
      );
    }

    let options: any[] = [];
    let filtered: any[] = [];

    if (activeTab === 'accounts') {
      options = accounts;
      filtered = filteredAccounts;
    } else if (activeTab === 'aliases') {
      options = aliases;
      filtered = filteredAliases;
    } else if (activeTab === 'tokens') {
      options = tokens;
      filtered = filteredTokens;
    }

    if (loading && options.length === 0) {
      return (
        <div className="px-4 py-8 text-center text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            加载中...
          </div>
        </div>
      );
    }

    if (filtered.length === 0) {
      return (
        <div className="px-4 py-8 text-center text-gray-400">
          {searchText ? '未找到匹配项' : '暂无数据'}
        </div>
      );
    }

    if (activeTab === 'accounts') {
      return (filteredAccounts as Account[]).map((acc, idx) => (
        <div
          key={`account-${idx}`}
          onClick={() => {
            onChange(acc.address, acc.account_name.toUpperCase());
            setIsOpen(false);
            setSearchText('');
          }}
          className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
            value.toLowerCase() === acc.address.toLowerCase() ? 'bg-blue-50' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 font-mono mt-1">{acc.address}</div>
            </div>
            {value.toLowerCase() === acc.address.toLowerCase() && (
              <div className="text-blue-600 font-bold ml-2">✓</div>
            )}
          </div>
          {acc.type === 'derived' && (
            <div className="text-xs text-orange-500 mt-1">派生账户（{acc.account_name.toUpperCase()}）</div>
          )}
        </div>
      ));
    } else if (activeTab === 'aliases') {
      return (filteredAliases as AddressAlias[]).map((alias, idx) => (
        <div
          key={`alias-${idx}`}
          onClick={() => {
            onChange(alias.address, alias.alias.toUpperCase());
            setIsOpen(false);
            setSearchText('');
          }}
          className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
            value.toLowerCase() === alias.address.toLowerCase() ? 'bg-blue-50' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">{alias.alias.toUpperCase()}</div>
              <div className="text-xs text-gray-500 font-mono mt-1">{alias.address}</div>
            </div>
            {value.toLowerCase() === alias.address.toLowerCase() && (
              <div className="text-blue-600 font-bold ml-2">✓</div>
            )}
          </div>
        </div>
      ));
    } else if (activeTab === 'tokens') {
      return (filteredTokens as CustomToken[]).map((token, idx) => (
        <div
          key={`token-${idx}`}
          onClick={() => {
            onChange(token.address, `${token.symbol}`);
            setIsOpen(false);
            setSearchText('');
          }}
          className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
            value.toLowerCase() === token.address.toLowerCase() ? 'bg-blue-50' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">{token.symbol}</div>
              <div className="text-xs text-gray-500 font-mono mt-1">{token.address}</div>
              <div className="text-xs text-gray-400 mt-1">精度: {token.decimals}</div>
            </div>
            {value.toLowerCase() === token.address.toLowerCase() && (
              <div className="text-blue-600 font-bold ml-2">✓</div>
            )}
          </div>
        </div>
      ));
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* 输入框 */}
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? searchText : selectedLabel}
        onChange={(e) => setSearchText(e.target.value)}
        onFocus={handleOpen}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
      />

      {/* 下拉框面板 */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
          {/* 标签页 */}
          <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0">
            {Object.entries(tabConfig).map(([tab, config]) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab as TabType)}
                className={`flex-1 px-3 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="text-sm">{config.icon}</span>
                <span className="hidden sm:inline">{config.label}</span>
                <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  {config.count}
                </span>
              </button>
            ))}
          </div>

          {/* 搜索框（自定义地址标签页不显示搜索框） */}
          {activeTab !== 'custom' && (
            <div className="border-b border-gray-200 p-2 sticky top-11 bg-white">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={`搜索${tabConfig[activeTab].label}...`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          )}

          {/* 选项列表 */}
          <div className="overflow-y-auto flex-1">
            {renderOptions()}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedAddressSelector;
import apiService from '@/lib/apiService';
import { listMainAccounts, listDerivedAccounts } from '@/lib/addressBooksService';
import { listAliases } from '@/lib/addressAliasesService';
import { listTokens } from '@/lib/tokensService';
