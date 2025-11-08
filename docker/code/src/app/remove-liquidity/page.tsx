import React from 'react';
import type { Metadata } from 'next';
import RemoveLiquidityClient from '@/components/swap/RemoveLiquidityClient';

export const metadata: Metadata = {
  title: '移除流动性 - Web3 交易平台',
  description: '从交易池移除流动性',
};

export default function RemoveLiquidityPage() {
  return <RemoveLiquidityClient />;
}