import React from 'react';
import type { Metadata } from 'next';
import SwapPageClient from '@/components/swap/SwapPageClient';

export const metadata: Metadata = {
  title: '交换 - Web3 交易平台',
  description: 'Web3 交易平台 - 代币交换功能',
};

export default function SwapPage() {
  return <SwapPageClient />;
}
