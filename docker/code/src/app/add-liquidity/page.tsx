import React from 'react';
import type { Metadata } from 'next';
import AddLiquidityClient from '@/components/swap/AddLiquidityClient';

export const metadata: Metadata = {
  title: '添加流动性 - Web3 交易平台',
  description: '向交易池添加流动性',
};

export default function AddLiquidityPage() {
  return <AddLiquidityClient />;
}