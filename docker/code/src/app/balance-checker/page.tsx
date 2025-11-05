import React from 'react';
import type { Metadata } from 'next';
import BalanceCheckerPageWrapper from '@/components/pages/BalanceCheckerPageWrapper';

export const metadata: Metadata = {
  title: '余额查询 - Web3 交易平台',
  description: 'Web3 交易平台 - 余额查询功能',
};

export default function BalanceCheckerPage() {
  return <BalanceCheckerPageWrapper />;
}
