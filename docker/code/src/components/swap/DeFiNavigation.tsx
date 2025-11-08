'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface DeFiNavigationProps {
  className?: string;
}

const DeFiNavigation: React.FC<DeFiNavigationProps> = ({ className = '' }) => {
  const pathname = usePathname();

  const navItems = [
    {
      name: '代币交换',
      href: '/swap',
      description: 'Swap tokens',
      icon: '⚡',
    },
    {
      name: '添加流动性',
      href: '/add-liquidity',
      description: 'Add liquidity to pools',
      icon: '💧',
    },
    {
      name: '移除流动性',
      href: '/remove-liquidity',
      description: 'Remove liquidity from pools',
      icon: '🔓',
    },
  ];

  return (
    <nav className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <h3 className="text-lg font-bold text-gray-900 mb-4">DeFi 功能</h3>
      <div className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block p-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 border border-blue-200 text-blue-900'
                  : 'hover:bg-gray-50 text-gray-700 border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.description}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default DeFiNavigation;