/**
 * API 服务层
 * 统一所有API调用，支持全局错误处理和请求拦截
 */

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: number;
  cache?: 'no-store' | 'reload' | 'force-cache' | 'only-if-cached';
}

class ApiService {
  private baseURL: string = '';
  private globalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  /**
   * 执行API请求
   */
  async request<T = any>(url: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const finalUrl = `${this.baseURL}${url}`;
    const defaultTimeout = 30000;
    const retries = typeof options.retry === 'number' ? options.retry : 0;

    const attempt = async (): Promise<ApiResponse<T>> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || defaultTimeout);

        const response = await fetch(finalUrl, {
          method: options.method || 'GET',
          headers: {
            ...this.globalHeaders,
            ...options.headers,
          },
          ...(options.body && { body: JSON.stringify(options.body) }),
          ...(options.cache && { cache: options.cache }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
          console.error(`API Error [${response.status}]:`, data);
          return { success: false, error: data.error || `HTTP ${response.status}` };
        }

        return { success: data.success ?? true, data: (data && typeof data === 'object' ? (data as any).data ?? data : data), error: (data as any)?.error };
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.name === 'AbortError'
              ? 'Request timeout'
              : err.message
            : 'Network error';
        console.error('API Request Error:', errorMessage);
        return { success: false, error: errorMessage };
      }
    };

    let lastResult: ApiResponse<T> = await attempt();
    let remaining = retries;
    while (!lastResult.success && remaining > 0) {
      await new Promise((r) => setTimeout(r, 500));
      lastResult = await attempt();
      remaining--;
    }
    return lastResult;
  }

  /**
   * GET 请求
   */
  get<T = any>(url: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * POST 请求
   */
  post<T = any>(url: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  /**
   * PUT 请求
   */
  put<T = any>(url: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return this.request<T>(url, { ...options, method: 'PUT', body });
  }

  /**
   * DELETE 请求
   */
  delete<T = any>(url: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  /**
   * 设置全局请求头
   */
  setGlobalHeaders(headers: Record<string, string>) {
    this.globalHeaders = {
      ...this.globalHeaders,
      ...headers,
    };
  }

  /**
   * 设置基础URL
   */
  setBaseURL(url: string) {
    this.baseURL = url;
  }
}

// 导出单例
export const apiService = new ApiService();

export default apiService;
