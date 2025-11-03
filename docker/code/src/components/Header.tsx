import React, { useEffect } from 'react';
import apiService from '@/lib/apiService';

interface HeaderProps {
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ title = "Web3 交易平台" }) => {
  // 初始化 API 基础 URL
  useEffect(() => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    if (apiBaseUrl) {
      apiService.setBaseURL(apiBaseUrl);
      console.log('[API Config] Base URL:', apiBaseUrl);
    }
  }, []);
  return (
    <header className="bg-white border-b border-gray-300 sticky top-0 z-50">
      <div className="px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-10">
          <h1 className="text-xl font-bold text-blue-600">{title}</h1>
          <nav className="flex gap-8">
            <a href="/" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
             仪表板
            </a>
            <a href="/trade" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
              交易
            </a>
            <a href="/swap" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
              交换
            </a>
            <a href="/balance-checker" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
              余额查询
            </a>
            <a href="/custom-function" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
              自定义函数
            </a>
            <a href="/address-books" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
              地址本
            </a>
            <a href="/settings" className="text-sm text-gray-700 hover:text-gray-900 font-medium">
              设置
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-300">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-green-700 font-medium text-xs">已连接</span>
          </div>
          <button className="w-9 h-9 bg-gray-400 rounded-full flex items-center justify-center hover:bg-gray-500 transition-colors">
            <span className="text-lg">👤</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;