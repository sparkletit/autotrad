'use client';

import React from 'react';
import Image from 'next/image';
import { WidgetType } from '@/hooks/useWidgetManager';

interface WidgetTriggerProps {
  onTrigger: (type: WidgetType) => void;
  className?: string;
}

const WidgetTrigger: React.FC<WidgetTriggerProps> = ({ onTrigger, className = '' }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const widgets = [
    {
      id: 'mint' as WidgetType,
      label: 'Mint资产',
      description: '将主网资产Mint到Fork',
      icon: '💰',
      color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200',
    },
    {
      id: 'wrap-wbnb' as WidgetType,
      label: '包装WBNB',
      description: '将BNB包装为WBNB',
      icon: '📦',
      color: 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200',
    },
    {
      id: 'token-management' as WidgetType,
      label: '代币管理',
      description: '添加/删除自定义代币',
      icon: '🏪',
      color: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200',
    },
    {
      id: 'swap-pool' as WidgetType,
      label: '交易池',
      description: '查看和配置交易池',
      icon: '🔄',
      color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200',
    },
  ];

  return (
    <>
      {/* 背景遮罩 */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40 bg-opacity-20"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* 浮窗容器 */}
      <div className={`fixed bottom-8 right-8 z-50 ${className}`}>
        {/* 菜单 */}
        {isExpanded && (
          <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-2xl border border-gray-200 w-64 p-3 mb-2 z-50">
            <div className="mb-3 px-0 py-2 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900">功能菜单</h3>
              <p className="text-xs text-gray-500 mt-1">选择要执行的操作</p>
            </div>
            <div className="space-y-2">
              {widgets.map((widget) => (
                <button
                  key={widget.id}
                  onClick={() => {
                    onTrigger(widget.id);
                    setIsExpanded(false);
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-left text-sm font-medium transition-all ${widget.color}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">{widget.icon}</span>
                    <div className="flex-1">
                      <div className="font-semibold">{widget.label}</div>
                      <div className="text-xs opacity-70 mt-0.5">{widget.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 主按钮 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all transform ${
            isExpanded
              ? 'bg-gray-600 hover:bg-gray-700 scale-100 rotate-180'
              : 'bg-white hover:shadow-xl scale-100'
          } focus:outline-none shadow-2xl`}
          title={isExpanded ? '关闭菜单' : '打开功能菜单'}
        >
          {isExpanded ? (
            <svg className="w-7 h-7 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.3 5.7L5.7 18.3M5.7 5.7L18.3 18.3" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </svg>
          ) : (
            <Image
              src="/tools-100.png"
              alt="Tools"
              width={32}
              height={32}
              priority
              className="rounded-lg"
            />
          )}
        </button>
      </div>
    </>
  );
};

export default WidgetTrigger;
