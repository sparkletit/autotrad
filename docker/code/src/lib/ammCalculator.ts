// AMM 计算工具库：格式化、价格计算、输入量计算
// 该文件为纯函数实现，可在前端页面直接调用

export const FEE_RATE = 0.0025; // PancakeSwap V2 手续费率

type PriceFormatOptions = {
  maxDecimals?: number;
  thousandSep?: boolean;
  smallStyle?: 'plain' | 'zeroCount';
  sigDigits?: number;
};

type FormatOptions = {
  decimals?: number;
  maxDecimals?: number;
  thousandSep?: boolean;
  scientificIfLarge?: boolean;
  smallStyle?: 'plain' | 'zeroCount';
  sigDigits?: number;
};

const pow10 = (n: number): bigint => {
  if (n < 0) throw new Error('pow10 不能为负');
  let s = '1';
  for (let i = 0; i < n; i++) s += '0';
  return BigInt(s);
};

const addThousandSep = (s: string, enable?: boolean) =>
  enable ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : s;

const parseDecimals = (d: unknown): number | undefined => {
  if (d === undefined || d === null) return undefined;
  let n: number;
  if (typeof d === 'number') n = Math.floor(d);
  else if (typeof d === 'string') n = Math.floor(parseFloat(d));
  else n = Math.floor(Number(d));
  if (isNaN(n) || n < 0 || n > 100) {
    throw new Error(`无效的精度值: ${String(d)}`);
  }
  return n;
};

export function format(value: bigint | number | string | { reserveA: bigint; reserveB: bigint; decimalsA: number; decimalsB: number }, options: FormatOptions = {}): string {
  const opts: Required<FormatOptions> = {
    decimals: options.decimals ?? undefined as unknown as number,
    maxDecimals: options.maxDecimals ?? 8,
    thousandSep: options.thousandSep ?? false,
    scientificIfLarge: options.scientificIfLarge ?? false,
    smallStyle: options.smallStyle ?? 'plain',
    sigDigits: options.sigDigits ?? 5,
  } as Required<FormatOptions>;

  const isPriceInput = (v: any): v is { reserveA: bigint; reserveB: bigint; decimalsA: number; decimalsB: number } =>
    v && typeof v === 'object' && 'reserveA' in v && 'reserveB' in v;

  if (isPriceInput(value)) {
    const { reserveA, reserveB, decimalsA, decimalsB } = value;
    const decA = parseDecimals(decimalsA) ?? 0;
    const decB = parseDecimals(decimalsB) ?? 0;
    const precision = 18; // 计算精度
    if (reserveA === BigInt(0)) return 'Infinity';

    const numerator = reserveB * pow10(decA) * pow10(precision);
    const denominator = reserveA * pow10(decB);
    const scaled = numerator / denominator; // 整数，包含 precision 位小数
    const scaleP = pow10(precision);
    const whole = scaled / scaleP;
    const fractional = scaled % scaleP;
    const fractionalStr = fractional.toString().padStart(precision, '0');

    if (whole > BigInt(0)) {
      const decPart = fractionalStr.slice(0, opts.maxDecimals).replace(/0+$/, '');
      const wholeWithSep = addThousandSep(whole.toString(), opts.thousandSep);
      return decPart.length ? `${wholeWithSep}.${decPart}` : wholeWithSep;
    } else {
      const firstNonZeroIdx = fractionalStr.search(/[1-9]/);
      if (firstNonZeroIdx === -1) {
        return opts.smallStyle === 'zeroCount' ? `0.{${precision}}0` : `0.${'0'.repeat(Math.min(2, opts.maxDecimals))}`;
      }
      if (opts.smallStyle === 'zeroCount') {
        const exp = firstNonZeroIdx + 1;
        const sig = fractionalStr.slice(firstNonZeroIdx, firstNonZeroIdx + opts.sigDigits);
        return `0.{${exp}}${sig}`;
      } else {
        const visible = fractionalStr.slice(0, opts.maxDecimals).replace(/0+$/, '');
        return visible.length ? `0.${visible}` : '0';
      }
    }
  }

  // 金额或整数格式化
  let vBig: bigint;
  if (typeof value === 'bigint') vBig = value;
  else {
    try {
      vBig = BigInt(value as any);
    } catch (_) {
      throw new Error(`format: 非法的数值类型 ${typeof value}`);
    }
  }

  const dec = parseDecimals(opts.decimals);
  if (dec === undefined) {
    const str = vBig.toString();
    if (opts.scientificIfLarge && str.length > 18) {
      const exp = str.length - 1;
      const mantissa = str[0] + '.' + str.substring(1, 6);
      return `${mantissa}e${exp}`;
    }
    return addThousandSep(str, opts.thousandSep);
  }

  const divisor = pow10(dec);
  const isNeg = vBig < BigInt(0);
  let abs = isNeg ? -vBig : vBig;
  const whole = abs / divisor;
  const fractional = abs % divisor;
  const wholeStr = addThousandSep(whole.toString(), opts.thousandSep);
  if (fractional === BigInt(0)) {
    return isNeg ? `-${wholeStr}` : wholeStr;
  }
  const fractionalStr = fractional.toString().padStart(dec, '0');
  const sliceLen = opts.maxDecimals ? Math.min(opts.maxDecimals, dec) : dec;
  const fracPart = fractionalStr.slice(0, sliceLen).replace(/0+$/, '');
  if (!fracPart.length) {
    return isNeg ? `-${wholeStr}` : wholeStr;
  }
  return isNeg ? `-${wholeStr}.${fracPart}` : `${wholeStr}.${fracPart}`;
}

export function formatNumber(value: bigint | number | string, decimals: number): string {
  return format(value, { decimals, thousandSep: true, smallStyle: 'plain' });
}

export function formatLargeNumber(value: bigint | number | string): string {
  return format(value, { scientificIfLarge: true });
}

export function calculatePrice(reserveA: bigint, reserveB: bigint, decimalsA: number, decimalsB: number, options: PriceFormatOptions = {}): string {
  return format({ reserveA, reserveB, decimalsA, decimalsB }, options);
}

export function calculateInputAmount(
  reserve0: bigint,
  reserve1: bigint,
  targetReserve: bigint,
  targetTokenIndex: 0 | 1,
  withFee: boolean
): { inputAmountNoFee: bigint; inputAmountWithFee: bigint; newReserve0: bigint; newReserve1: bigint } {
  const k = reserve0 * reserve1;
  const feeMultiplier = BigInt(Math.floor((1 - FEE_RATE) * 10000));

  let newReserve0: bigint, newReserve1: bigint, inputAmount: bigint, inputAmountNoFee: bigint;

  if (targetTokenIndex === 0) {
    if (targetReserve === BigInt(0)) throw new Error('目标储备量不能为0');
    newReserve0 = targetReserve;
    newReserve1 = k / newReserve0;
    const requiredReserve1Increase = newReserve1 - reserve1;
    inputAmountNoFee = requiredReserve1Increase;

    if (withFee) {
      inputAmount = (requiredReserve1Increase * BigInt(10000)) / feeMultiplier;
      const actualInput = (inputAmount * feeMultiplier) / BigInt(10000);
      newReserve1 = reserve1 + actualInput;
      const token0Out = (reserve0 * actualInput) / (reserve1 + actualInput);
      newReserve0 = reserve0 - token0Out;
    } else {
      inputAmount = inputAmountNoFee;
    }
  } else {
    if (targetReserve === BigInt(0)) throw new Error('目标储备量不能为0');
    newReserve1 = targetReserve;
    newReserve0 = k / newReserve1;
    const requiredReserve0Increase = newReserve0 - reserve0;
    inputAmountNoFee = requiredReserve0Increase;

    if (withFee) {
      inputAmount = (requiredReserve0Increase * BigInt(10000)) / feeMultiplier;
      const actualInput = (inputAmount * feeMultiplier) / BigInt(10000);
      newReserve0 = reserve0 + actualInput;
      const token1Out = (reserve1 * actualInput) / (reserve0 + actualInput);
      newReserve1 = reserve1 - token1Out;
    } else {
      inputAmount = inputAmountNoFee;
    }
  }

  const ensureBigInt = (val: any, name: string): bigint => {
    if (val === undefined || val === null) throw new Error(`${name} 是 undefined 或 null`);
    if (typeof val === 'bigint') return val;
    try { return BigInt(val); } catch (e: any) { throw new Error(`无法将 ${name} 转换为 BigInt: ${e?.message || e}`); }
  };

  return {
    inputAmountNoFee: ensureBigInt(inputAmountNoFee, 'inputAmountNoFee'),
    inputAmountWithFee: ensureBigInt(inputAmount, 'inputAmount'),
    newReserve0: ensureBigInt(newReserve0, 'newReserve0'),
    newReserve1: ensureBigInt(newReserve1, 'newReserve1')
  };
}

/**
 * 经典恒定乘积 AMM 公式：给定输入数量，计算输出数量
 * getAmountOut(amountIn, reserveIn, reserveOut, withFee)
 */
export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  withFee: boolean = true
): bigint {
  if (amountIn <= BigInt(0)) return BigInt(0);
  if (reserveIn <= BigInt(0) || reserveOut <= BigInt(0)) return BigInt(0);

  const feeBasis = BigInt(10000);
  const feeMultiplier = withFee
    ? BigInt(Math.floor((1 - FEE_RATE) * Number(feeBasis)))
    : feeBasis;

  const amountInWithFee = (amountIn * feeMultiplier) / feeBasis;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn + amountInWithFee;
  return numerator / denominator;
}

/**
 * 经典恒定乘积 AMM 公式：给定期望输出数量，反推所需输入数量
 * getAmountIn(amountOut, reserveIn, reserveOut, withFee)
 */
export function getAmountIn(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  withFee: boolean = true
): bigint {
  if (amountOut <= BigInt(0)) return BigInt(0);
  if (reserveIn <= BigInt(0) || reserveOut <= BigInt(0)) return BigInt(0);
  if (amountOut >= reserveOut) return BigInt(0);

  const feeBasis = BigInt(10000);
  const feeMultiplier = withFee
    ? BigInt(Math.floor((1 - FEE_RATE) * Number(feeBasis)))
    : feeBasis;

  const numerator = reserveIn * amountOut * feeBasis;
  const denominator = (reserveOut - amountOut) * feeMultiplier;
  return numerator / denominator + BigInt(1); // 向上取整一单位
}

/**
 * 将十进制文本转换为底层单位 bigint（前端使用）
 */
export function parseUnitsFromDecimalText(value: string, decimals: number): bigint {
  const trimmed = (value || '').trim();
  if (!trimmed) return BigInt(0);
  const str = trimmed.replace(/,/g, '');
  const m = str.match(/^([0-9]+)(\.)?([0-9]*)$/);
  if (!m) return BigInt(0);
  const integer = m[1] || '0';
  const fraction = (m[3] || '').slice(0, Math.max(0, decimals));
  const paddedFraction = fraction.padEnd(Math.max(0, decimals), '0');
  const full = integer + paddedFraction;
  try {
    return BigInt(full);
  } catch {
    return BigInt(0);
  }
}

/**
 * 将底层单位 bigint 格式化为十进制文本（与 format 不同：始终禁用千分位，用于输入回显）
 */
export function formatUnitsToDecimalText(value: bigint, decimals: number, maxDecimals: number = 8): string {
  return format(value, { decimals, maxDecimals, thousandSep: false });
}