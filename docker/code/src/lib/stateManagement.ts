/**
 * 状态管理工具库 - 处理通用的加载、错误、成功状态
 */

export interface AsyncState {
  loading: boolean;
  error: string;
  success: string;
  txHash?: string;
}

export const defaultAsyncState: AsyncState = {
  loading: false,
  error: '',
  success: '',
  txHash: '',
};

/**
 * 重置异步状态
 */
export const resetAsyncState = (): AsyncState => {
  return { ...defaultAsyncState };
};

/**
 * 显示成功消息并在指定时间后自动清除
 */
export const showSuccessAndClear = (
  successMessage: string,
  duration: number = 3000,
  onClear?: () => void
): (() => void) => {
  const timeoutId = setTimeout(() => {
    onClear?.();
  }, duration);

  return () => clearTimeout(timeoutId);
};

/**
 * 显示错误消息并在指定时间后自动清除
 */
export const showErrorAndClear = (
  errorMessage: string,
  duration: number = 5000,
  onClear?: () => void
): (() => void) => {
  const timeoutId = setTimeout(() => {
    onClear?.();
  }, duration);

  return () => clearTimeout(timeoutId);
};

/**
 * 处理异步操作的通用函数
 */
export const handleAsyncOperation = async <T,>(
  asyncFn: () => Promise<T>,
  callbacks: {
    onStart?: () => void;
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
    onFinally?: () => void;
  }
): Promise<T | null> => {
  try {
    callbacks.onStart?.();
    const result = await asyncFn();
    callbacks.onSuccess?.(result);
    return result;
  } catch (error: any) {
    const errorMsg = error?.message || '操作失败，请重试';
    callbacks.onError?.(errorMsg);
    return null;
  } finally {
    callbacks.onFinally?.();
  }
};
