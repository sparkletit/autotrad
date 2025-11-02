'use client';

import React from 'react';
import type { Metadata } from 'next';
import TradePageClient from '@/components/trade/TradePageClient';

export const metadata: Metadata = {
  title: '交易 - Web3 交易平台',
  description: 'Web3 交易平台 - 代币转账功能',
};

export default function TradePage() {
  return <TradePageClient />;
}
