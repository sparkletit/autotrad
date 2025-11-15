/**
 * 通用地址工具：校验与规范化
 */
import { getAddress } from 'viem';
import type { Address } from 'viem';

/**
 * 校验并返回 EIP-55 校验和地址。
 * 抛错：当输入不是有效地址时。
 */
export function normalizeAddress(input: string): Address {
  return getAddress(input);
}

/**
 * 尝试规范化地址，失败返回 undefined。
 */
export function tryNormalizeAddress(input?: string | null): Address | undefined {
  if (!input) return undefined;
  try {
    return getAddress(input);
  } catch {
    return undefined;
  }
}


/**
 * 全零地址（校验和形式）。
 */
export const ZERO_ADDRESS: Address = getAddress('0x0000000000000000000000000000000000000000');

/**
 * 将地址转为小写字符串（不改变类型）。
 */
export function toLowerAddress(addr: Address): Address {
  return (addr.toLowerCase() as Address);
}

/**
 * 读取 ERC20 的 decimals，支持校验和失败回退：
 * 1) 用校验和地址读；失败则 2) 用小写地址读；仍失败则返回 18。
 */
export async function safeReadDecimals(publicClient: any, token: Address): Promise<number> {
  const ERC20_ABI = [
    { constant: true, inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], type: 'function' },
  ] as const;
  try {
    return await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'decimals' });
  } catch (e1) {
    try {
      const lower = toLowerAddress(token);
      return await publicClient.readContract({ address: lower, abi: ERC20_ABI, functionName: 'decimals' });
    } catch (e2) {
      return 18;
    }
  }
}
// 通用工具函数库

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
    const isNeg = bigBalance < BigInt(0);
    const abs = isNeg ? -bigBalance : bigBalance;
    const wholePart = abs / divisor;
    const fractionalPart = abs % divisor;

    if (wholePart === BigInt(0)) {
      const fracFull = fractionalPart.toString().padStart(decimals, '0');
      const firstNonZero = fracFull.search(/[1-9]/);
      if (firstNonZero === -1) return '0';
      const zerosCount = firstNonZero;
      const sig = fracFull.slice(firstNonZero, firstNonZero + 4) || '0';
      return `${isNeg ? '-' : ''}0.{${zerosCount}}${sig}`;
    }

    let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    fractionalStr = fractionalStr.substring(0, 5);
    fractionalStr = fractionalStr.replace(/0+$/, '');

    let result = wholePart.toString();
    if (fractionalStr) {
      result += '.' + fractionalStr;
    }

    const num = parseFloat(result);
    const withSep = formatNumber(num, 5);
    return isNeg ? `-${withSep}` : withSep;
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
