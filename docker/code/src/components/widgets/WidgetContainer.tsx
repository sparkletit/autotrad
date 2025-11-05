'use client';

import React from 'react';
import MintWidget from './MintWidget';
import WrapWBNBWidget from './WrapWBNBWidget';
import TokenManagementWidget from './TokenManagementWidget';
import SwapPoolWidget from './SwapPoolWidget';
import { WidgetType } from '@/hooks/useWidgetManager';

interface WidgetContainerProps {
  isOpen: boolean;
  activeWidget: WidgetType | null;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Widget 容器组件
 * 统一管理所有 Widget 的显示和隐藏
 */
const WidgetContainer: React.FC<WidgetContainerProps> = ({
  isOpen,
  activeWidget,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <MintWidget
        isOpen={isOpen && activeWidget === 'mint'}
        onClose={onClose}
        onSuccess={onSuccess}
      />
      <WrapWBNBWidget
        isOpen={isOpen && activeWidget === 'wrap-wbnb'}
        onClose={onClose}
        onSuccess={onSuccess}
      />
      <TokenManagementWidget
        isOpen={isOpen && activeWidget === 'token-management'}
        onClose={onClose}
        onSuccess={onSuccess}
      />
      <SwapPoolWidget
        isOpen={isOpen && activeWidget === 'swap-pool'}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </>
  );
};

export default WidgetContainer;
