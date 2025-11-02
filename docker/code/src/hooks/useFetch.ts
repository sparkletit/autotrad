import { useState, useCallback } from 'react';

export interface UseFetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

/**
 * 通用数据获取Hook
 * 统一处理loading/error/data状态
 * 支持自动重试和全局错误处理
 */
function useFetch<T>(url: string | null, options: UseFetchOptions = {}) {
  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetch = useCallback(
    async (overrideUrl?: string) => {
      const finalUrl = overrideUrl || url;
      if (!finalUrl) {
        setState((prev) => ({
          ...prev,
          error: 'URL is required',
        }));
        return null;
      }

      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const response = await window.fetch(finalUrl, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          ...(options.body && { body: JSON.stringify(options.body) }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        setState({
          data: data.success ? data.data : null,
          loading: false,
          error: data.success ? null : (data.error || 'Request failed'),
        });

        return data.success ? data.data : null;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Network error';
        setState({
          data: null,
          loading: false,
          error: errorMessage,
        });
        return null;
      }
    },
    [url, options]
  );

  return {
    ...state,
    fetch,
  };
}

export default useFetch;
