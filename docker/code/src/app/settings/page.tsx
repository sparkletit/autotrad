import React from 'react';
import Header from '@/components/Header';
import type { Metadata } from 'next';
import SettingsPageClient from '@/components/settings/SettingsPageClient';

export const metadata: Metadata = {
  title: '设置',
  description: 'Web3 交易平台 - 设置功能',
};

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="设置" />
      <SettingsPageClient />
    </div>
  );
}
