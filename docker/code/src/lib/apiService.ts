/**
 * API 服务层
 * 统一所有API调用，支持全局错误处理和请求拦截
 */

/**
 * 格式化余额，保留小数后5位
 * @param balance 余额（Wei 或最小单位）
 * @param decimals 代币小数位数
 * @returns 格式化后的余额字符串，保留5位小数
 */
export function formatBalance(balance: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const integerPart = balance / divisor;
  const remainderPart = balance % divisor;
  
  // 计算小数部分
  const remainderStr = remainderPart.toString().padStart(decimals, '0');
  // 只保留前5位小数
  const decimalPart = remainderStr.substring(0, 5).padEnd(5, '0');
  
  // 移除尾部的零
  const decimalPartTrimmed = decimalPart.replace(/0+$/, '');
  
  // 如果没有小数部分，只返回整数部分
  if (decimalPartTrimmed.length === 0) {
    return integerPart.toString();
  }
  
  return `${integerPart}.${decimalPartTrimmed}`;
}

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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        console.error(`API Error [${response.status}]:`, data);
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        };
      }

      return {
        success: data.success ?? true,
        data: data.data,
        error: data.error,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.name === 'AbortError'
            ? 'Request timeout'
            : err.message
          : 'Network error';

      console.error('API Request Error:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
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
