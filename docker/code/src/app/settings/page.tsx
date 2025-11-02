import React from 'react';
import type { Metadata } from 'next';
import SettingsPageClient from '@/components/settings/SettingsPageClient';

export const metadata: Metadata = {
  title: '设置 - Web3 交易平台',
  description: 'Web3 交易平台 - 系统设置和配置',
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
