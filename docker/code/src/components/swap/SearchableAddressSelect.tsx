'use client';

import React, { useState, useEffect, useRef } from 'react';

interface AddressAlias {
  id: number;
  alias: string;
  address: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const SearchableAddressSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  placeholder = '搜索地址别名或粘贴地址...',
  disabled = false,
}) => {
  const [searchText, setSearchText] = useState('');
  const [options, setOptions] = useState<AddressAlias[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 获取默认的10条地址别名
  const fetchDefaultAliases = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/address-aliases/search');
      const data = await response.json();
      if (data.success) {
        setOptions(data.data || []);
      } else {
        console.error('获取地址别名失败:', data.error);
        setOptions([]);
      }
    } catch (err) {
      console.error('获取地址别名失败:', err);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // 获取选中项的标签
  useEffect(() => {
    if (value) {
      const selected = options.find(opt => opt.address.toLowerCase() === value.toLowerCase());
      if (selected) {
        setSelectedLabel(`${selected.alias} (${selected.address.slice(0, 6)}...${selected.address.slice(-4)})`);
      } else if (value.match(/^0x[a-fA-F0-9]{40}$/)) {
        setSelectedLabel(`${value.slice(0, 6)}...${value.slice(-4)}`);
      }
    } else {
      setSelectedLabel('');
    }
  }, [value, options]);

  // 搜索地址别名（仅按alias_name搜索）
  const searchAliases = async (query: string) => {
    if (!query.trim()) {
      // 如果搜索框为空，显示默认10条
      await fetchDefaultAliases();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/address-aliases/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (data.success) {
        setOptions(data.data || []);
      }
    } catch (err) {
      console.error('搜索地址别名失败:', err);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setSearchText(text);
    setIsOpen(true);
    if (text.trim()) {
      searchAliases(text);
    } else {
      setOptions([]);
    }
  };

  const handleSelectOption = (option: AddressAlias) => {
    onChange(option.address);
    setSearchText('');
    setIsOpen(false);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted.match(/^0x[a-fA-F0-9]{40}$/)) {
      onChange(pasted);
      setSearchText('');
      setIsOpen(false);
    }
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex flex-col">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchText : selectedLabel}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onFocus={() => {
            setIsOpen(true);
            // 打开下拉框时，如果为空则加载默认列表
            if (!searchText) {
              fetchDefaultAliases();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
          {/* 搜索框 */}
          <div className="border-b border-gray-200 p-2 sticky top-0 bg-white">
            <input
              type="text"
              value={searchText}
              onChange={handleInputChange}
              placeholder="搜索地址别名或地址..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* 结果列表 */}
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                加载中...
              </div>
            )}
            {!loading && options.length === 0 && searchText && (
              <div className="px-4 py-2 text-sm text-gray-500">未找到匹配的地址</div>
            )}
            {!loading && options.length > 0 && options.map((option, index) => (
              <div
                key={`address-alias-${index}`}
                onClick={() => handleSelectOption(option)}
                className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-sm transition-colors"
              >
                <div className="font-medium text-gray-900">{option.alias}</div>
                <div className="text-xs text-gray-500 font-mono">{option.address}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableAddressSelect;
