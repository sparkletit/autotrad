import { useState, useCallback } from 'react';

export type WidgetType = 'mint' | 'wrap-wbnb' | 'token-management' | 'swap-pool' | 'fork-state';

interface WidgetState {
  isOpen: boolean;
  type: WidgetType | null;
}

export function useWidgetManager() {
  const [widget, setWidget] = useState<WidgetState>({
    isOpen: false,
    type: null,
  });

  const openWidget = useCallback((type: WidgetType) => {
    setWidget({ isOpen: true, type });
  }, []);

  const closeWidget = useCallback(() => {
    setWidget({ isOpen: false, type: null });
  }, []);

  return { 
    isOpen: widget.isOpen, 
    activeWidget: widget.type, 
    openWidget, 
    closeWidget 
  };
}
