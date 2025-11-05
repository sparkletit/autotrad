'use client';

import React from 'react';
import WidgetTrigger from '@/components/common/WidgetTrigger';
import WidgetContainer from '@/components/widgets/WidgetContainer';
import { useWidgetManager } from '@/hooks/useWidgetManager';

interface WidgetLayoutProps {
  children: React.ReactNode;
}

/**
 * Widget Layout
 * 为页面提供 Widget 系统的包装器
 * 在任何页面中使用此布局，即可获得完整的 Widget 功能
 */
export function WidgetLayout({ children }: WidgetLayoutProps) {
  const { isOpen, activeWidget, openWidget, closeWidget } = useWidgetManager();

  return (
    <>
      {/* 页面内容 */}
      {children}

      {/* Widget Trigger 按钮 */}
      <WidgetTrigger onTrigger={openWidget} />

      {/* Widget Container */}
      <WidgetContainer
        isOpen={isOpen}
        activeWidget={activeWidget}
        onClose={closeWidget}
      />
    </>
  );
}
