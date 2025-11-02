'use client';
'use client';

import React from 'react';
import type { Metadata } from 'next';
import AddressBooksClient from '@/components/address-books/AddressBooksClient';

export const metadata: Metadata = {
  title: '地址本 - Web3 交易平台',
  description: 'Web3 交易平台 - 管理钱包账号和派生账号',
};

export default function AddressBooksPage() {
  return <AddressBooksClient />;
}
