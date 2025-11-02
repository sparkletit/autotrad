'use client';

import React from 'react';
import type { Metadata } from 'next';
import CustomFunctionClient from '@/components/custom-function/CustomFunctionClient';

export const metadata: Metadata = {
  title: '自定义函数 - Web3 交易平台',
  description: 'Web3 交易平台 - 自定义智能合约函数执行',
};

export default function CustomFunctionPage() {
  return <CustomFunctionClient />;
}
