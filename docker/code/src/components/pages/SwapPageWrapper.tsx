'use client';

import SwapPageClient from '@/components/swap/SwapPageClient';
import WidgetTrigger from '@/components/common/WidgetTrigger';
import WidgetContainer from '@/components/widgets/WidgetContainer';
import { useWidgetManager } from '@/hooks/useWidgetManager';

export default function SwapPageWrapper() {
  const { isOpen, activeWidget, openWidget, closeWidget } = useWidgetManager();

  return (
    <>
      <SwapPageClient />
      <WidgetTrigger onTrigger={openWidget} />
      <WidgetContainer
        isOpen={isOpen}
        activeWidget={activeWidget}
        onClose={closeWidget}
      />
    </>
  );
}
