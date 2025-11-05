'use client';

import BalanceCheckerClient from '@/components/balance-checker/BalanceCheckerClient';
import WidgetTrigger from '@/components/common/WidgetTrigger';
import WidgetContainer from '@/components/widgets/WidgetContainer';
import { useWidgetManager } from '@/hooks/useWidgetManager';

export default function BalanceCheckerPageWrapper() {
  const { isOpen, activeWidget, openWidget, closeWidget } = useWidgetManager();

  return (
    <>
      <BalanceCheckerClient />
      <WidgetTrigger onTrigger={openWidget} />
      <WidgetContainer
        isOpen={isOpen}
        activeWidget={activeWidget}
        onClose={closeWidget}
      />
    </>
  );
}
