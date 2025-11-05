'use client';

import TradePageClient from '@/components/trade/TradePageClient';
import { WidgetLayout } from '@/components/layouts/WidgetLayout';

export default function TradePageWrapper() {
  return (
    <WidgetLayout>
      <TradePageClient />
    </WidgetLayout>
  );
}
