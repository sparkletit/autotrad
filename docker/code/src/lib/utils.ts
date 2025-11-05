/**
 * 通用工具函数库
 */

/**
 * 验证以太坊地址格式
 */
export const isValidAddress = (address: string): boolean => {
  if (!address) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * 格式化地址显示（省略号格式）
 */
export const formatAddress = (address: string, startChars = 6, endChars = 4): string => {
  if (!address || address.length < startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * 验证正整数
 */
export const isValidNumber = (value: string | number): boolean => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num > 0;
};

/**
 * 格式化大数值显示（添加千位分隔符）
 */
export const formatNumber = (num: number | string, decimals = 2): string => {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
};

/**
 * 处理异步操作的错误消息
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '操作失败，请重试';
};

/**
 * 复制到剪贴板
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
};

/**
 * 延迟函数（毫秒）
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 防抖函数
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * 节流函数
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let lastFunc: ReturnType<typeof setTimeout> | null = null;
  let lastRun = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRun >= limit) {
      func(...args);
      lastRun = now;
    } else {
      if (lastFunc) clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        func(...args);
        lastRun = Date.now();
      }, limit - (now - lastRun));
    }
  };
};

/**
 * 十进制转十六进制
 */
export const toHex = (value: number | string): string => {
  const num = typeof value === 'string' ? parseInt(value) : value;
  return '0x' + num.toString(16);
};

/**
 * 格式化余额显示
 * @param balance 余额（最小单位）
 * @param decimals 精度（默认为18）
 * @returns 格式化后的余额字符串
 */
export const formatBalance = (balance: string | bigint | number, decimals: number = 18): string => {
  try {
    const bigBalance = typeof balance === 'string' ? BigInt(balance) : BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const wholePart = bigBalance / divisor;
    const fractionalPart = bigBalance % divisor;

    // 构造小数部分，最多5位
    let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    fractionalStr = fractionalStr.substring(0, 5); // 只保留5位
    fractionalStr = fractionalStr.replace(/0+$/, ''); // 移除尾部零

    let result = wholePart.toString();
    if (fractionalStr) {
      result += '.' + fractionalStr;
    }

    // 使用 formatNumber 进行千分位分隔
    return formatNumber(parseFloat(result), 5);
  } catch (err) {
    console.error('formatBalance error:', err);
    return '0';
  }
};

/**
 * 十六进制转十进制
 */
export const fromHex = (hex: string): number => {
  return parseInt(hex.replace('0x', ''), 16);
};
