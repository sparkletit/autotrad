'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Header from '@/components/Header';
import UnifiedAddressSelector from '@/components/common/UnifiedAddressSelector';
import DeFiNavigation from '@/components/swap/DeFiNavigation';
import { fetchCustomTokens } from '@/lib/addressService';
import {
  format,
  formatLargeNumber,
  calculatePrice,
  FEE_RATE,
  getAmountOut,
  getAmountIn,
  parseUnitsFromDecimalText,
  formatUnitsToDecimalText,
  computeAddLiquidityOptimal,
} from '@/lib/ammCalculator';

export default function SwapPairCalculatorPage() {
  const [pairAddress, setPairAddress] = useState('');
  const [network, setNetwork] = useState<'fork' | 'bsc' | 'ethereum' | 'polygon'>('fork');

  const [token0Address, setToken0Address] = useState<string>('');
  const [token1Address, setToken1Address] = useState<string>('');

  const [token0Decimals, setToken0Decimals] = useState<number>(18);
  const [token1Decimals, setToken1Decimals] = useState<number>(18);

  const [alias0, setAlias0] = useState<string>('Token0');
  const [alias1, setAlias1] = useState<string>('Token1');

  const [reserve0, setReserve0] = useState<bigint>(BigInt(0));
  const [reserve1, setReserve1] = useState<bigint>(BigInt(0));
  const [totalSupply, setTotalSupply] = useState<bigint>(BigInt(0));

  const [withFee, setWithFee] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [lastDirection, setLastDirection] = useState<'0to1' | '1to0' | 'desired1' | 'desired0' | 'lpMint' | 'lpBurn' | null>(null);

  // 输入框（人类单位）
  const [amount0InText, setAmount0InText] = useState<string>('');
  const [amount1OutText, setAmount1OutText] = useState<string>('');
  const [amount1InText, setAmount1InText] = useState<string>('');
  const [amount0OutText, setAmount0OutText] = useState<string>('');

  // 目标输出→所需输入
  const [desired1OutText, setDesired1OutText] = useState<string>('');
  const [required0InText, setRequired0InText] = useState<string>('');
  const [desired0OutText, setDesired0OutText] = useState<string>('');
  const [required1InText, setRequired1InText] = useState<string>('');

  // LP 相关：按固定比例铸造与移除
  const [mint0InText, setMint0InText] = useState<string>('');
  const [mint1InText, setMint1InText] = useState<string>('');
  const [lpMintOutText, setLpMintOutText] = useState<string>('');

  // 最优数量（合约 addLiquidity 逻辑中的 amountTokenOptimal 显示）
  const [amount0OptimalText, setAmount0OptimalText] = useState<string>('');
  const [amount1OptimalText, setAmount1OptimalText] = useState<string>('');
  // UI：是否将显示值扣除 0.25%（仅用于显示净值）
  const [applyOptimalNetDisplay, setApplyOptimalNetDisplay] = useState<boolean>(false);

  const [lpBurnInText, setLpBurnInText] = useState<string>('');
  const [burn0OutText, setBurn0OutText] = useState<string>('');
  const [burn1OutText, setBurn1OutText] = useState<string>('');

  // 交易后储备（模拟）
  const [postReserve0, setPostReserve0] = useState<bigint>(BigInt(0));
  const [postReserve1, setPostReserve1] = useState<bigint>(BigInt(0));
  // 手动编辑当前储备（人类单位文本）
  const [manualReserve0Text, setManualReserve0Text] = useState<string>('');
  const [manualReserve1Text, setManualReserve1Text] = useState<string>('');

  // 加载自定义代币用于自动别名与精度
  useEffect(() => {
    const loadTokens = async () => {
      try {
        const tokens = await fetchCustomTokens();
        if (tokens && tokens.length) {
          const t0 = tokens.find((t) => t.address.toLowerCase() === token0Address.toLowerCase());
          const t1 = tokens.find((t) => t.address.toLowerCase() === token1Address.toLowerCase());
          if (t0) {
            setAlias0(t0.symbol || alias0);
            if (typeof t0.decimals === 'number') setToken0Decimals(t0.decimals);
          }
          if (t1) {
            setAlias1(t1.symbol || alias1);
            if (typeof t1.decimals === 'number') setToken1Decimals(t1.decimals);
          }
        }
      } catch (_) {
        // 静默失败
      }
    };
    if (token0Address || token1Address) loadTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token0Address, token1Address]);

  // 获取储备与token地址
  const fetchReserves = useCallback(async () => {
    if (!pairAddress) return;
    try {
      const res = await fetch('/api/swap/get-reserves', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pairAddress, network }),
      });
      const json = await res.json();
      if (json?.success && json?.data) {
        const { reserve0: r0, reserve1: r1, token0, token1, totalSupply: ts } = json.data;
        setReserve0(BigInt(r0));
        setReserve1(BigInt(r1));
        setToken0Address(token0 || '');
        setToken1Address(token1 || '');
        if (ts !== undefined) {
          try {
            setTotalSupply(BigInt(ts));
          } catch (_) {
            // ignore parse error
          }
        }
        return;
      }
      // Fallback
      const resFallback = await fetch(`/api/pair/${pairAddress}/reserves`);
      const jsonFallback = await resFallback.json();
      if (jsonFallback?.reserve0 && jsonFallback?.reserve1) {
        setReserve0(BigInt(jsonFallback.reserve0));
        setReserve1(BigInt(jsonFallback.reserve1));
      }
    } catch (e) {
      // 默认示例值（防止界面空白）
      setReserve0(BigInt('1340217431612257426'));
      setReserve1(BigInt('138918411710737798835376664869'));
    }
  }, [pairAddress, network]);

  useEffect(() => {
    fetchReserves();
  }, [pairAddress, network, fetchReserves]);

  // 价格展示（不考虑手续费）
  const price0 = useMemo(
    () =>
      calculatePrice(reserve0, reserve1, token0Decimals, token1Decimals, {
        thousandSep: true,
        smallStyle: 'zeroCount',
        sigDigits: 4,
      }),
    [reserve0, reserve1, token0Decimals, token1Decimals]
  );
  const price1 = useMemo(
    () =>
      calculatePrice(reserve1, reserve0, token1Decimals, token0Decimals, {
        thousandSep: true,
        smallStyle: 'zeroCount',
        sigDigits: 4,
      }),
    [reserve0, reserve1, token0Decimals, token1Decimals]
  );

  const feeBasis = 10000n;
  const feeMultiplier = useMemo(() => BigInt(Math.floor((1 - FEE_RATE) * 10000)), []);

  // 应用手动储备为当前基数
  const applyManualReserves = useCallback(() => {
    const r0 = parseUnitsFromDecimalText(manualReserve0Text, token0Decimals);
    const r1 = parseUnitsFromDecimalText(manualReserve1Text, token1Decimals);
    if (r0 <= 0n || r1 <= 0n) {
      return;
    }
    setReserve0(r0);
    setReserve1(r1);
    setPostReserve0(r0);
    setPostReserve1(r1);
    setLastDirection(null);
  }, [manualReserve0Text, manualReserve1Text, token0Decimals, token1Decimals]);

  // 从链上重置储备
  const resetReservesFromChain = useCallback(() => {
    setManualReserve0Text('');
    setManualReserve1Text('');
    fetchReserves();
  }, [fetchReserves]);

  const simulateToken0To1 = useCallback((text: string) => {
    setAmount0InText(text);
    setLastDirection('0to1');
    // 互斥：清空另一方向
    setAmount1InText('');
    setAmount0OutText('');
    const amountIn = parseUnitsFromDecimalText(text, token0Decimals);
    if (amountIn <= 0n || reserve0 <= 0n || reserve1 <= 0n) {
      setAmount1OutText('');
      setPostReserve0(reserve0);
      setPostReserve1(reserve1);
      return;
    }
    const amountOut = getAmountOut(amountIn, reserve0, reserve1, withFee);
    setAmount1OutText(formatUnitsToDecimalText(amountOut, token1Decimals));
    const effectiveIn = withFee ? (amountIn * feeMultiplier) / feeBasis : amountIn;
    setPostReserve0(reserve0 + effectiveIn);
    setPostReserve1(reserve1 - amountOut);
  }, [token0Decimals, token1Decimals, reserve0, reserve1, withFee, feeMultiplier]);

  const simulateToken1To0 = useCallback((text: string) => {
    setAmount1InText(text);
    setLastDirection('1to0');
    // 互斥：清空另一方向
    setAmount0InText('');
    setAmount1OutText('');
    const amountIn = parseUnitsFromDecimalText(text, token1Decimals);
    if (amountIn <= 0n || reserve0 <= 0n || reserve1 <= 0n) {
      setAmount0OutText('');
      setPostReserve0(reserve0);
      setPostReserve1(reserve1);
      return;
    }
    const amountOut = getAmountOut(amountIn, reserve1, reserve0, withFee);
    setAmount0OutText(formatUnitsToDecimalText(amountOut, token0Decimals));
    const effectiveIn = withFee ? (amountIn * feeMultiplier) / feeBasis : amountIn;
    setPostReserve1(reserve1 + effectiveIn);
    setPostReserve0(reserve0 - amountOut);
  }, [token0Decimals, token1Decimals, reserve0, reserve1, withFee, feeMultiplier]);

  // 辅助：BigInt 整数平方根（用于初始 totalSupply=0 的 LP 铸造估算）
  const intSqrt = useCallback((value: bigint): bigint => {
    if (value <= 0n) return 0n;
    let x = value;
    let y = (x + 1n) >> 1n;
    while (y < x) {
      x = y;
      y = (y + value / y) >> 1n;
    }
    return x;
  }, []);

  // 固定比例添加流动性：输入 t0 与 t1，计算可铸造 LP 数量
  const recalcMint = useCallback((text0: string, text1: string) => {
    setLastDirection('lpMint');
    const a0 = parseUnitsFromDecimalText(text0, token0Decimals);
    const a1 = parseUnitsFromDecimalText(text1, token1Decimals);
    if (a0 <= 0n || a1 <= 0n) {
      setLpMintOutText('');
      setAmount0OptimalText('');
      setAmount1OptimalText('');
      setPostReserve0(reserve0);
      setPostReserve1(reserve1);
      return;
    }
    // 计算最优数量建议（与 Router addLiquidityETH 的 amountTokenOptimal 同理）
    // 传递手续费选项，使得最优数量在考虑 0.25% 费用时更贴近链上表现
    const optimal = computeAddLiquidityOptimal(a0, a1, reserve0, reserve1, withFee);

    // 使用最优存入对作为实际加入储备的数量
    const depositA = optimal.amountA;
    const depositB = optimal.amountB;
    // 生效净值（扣除 0.25% 手续费）
    const effectiveA = withFee ? (depositA * feeMultiplier) / feeBasis : depositA;
    const effectiveB = withFee ? (depositB * feeMultiplier) / feeBasis : depositB;

    // 铸造 LP 数量应基于进入储备的有效净值计算
    let liquidity: bigint = 0n;
    if (totalSupply === 0n) {
      // 初始池：近似 sqrt(effectiveA * effectiveB)
      liquidity = intSqrt(effectiveA * effectiveB);
    } else {
      const l0 = (effectiveA * totalSupply) / (reserve0 === 0n ? 1n : reserve0);
      const l1 = (effectiveB * totalSupply) / (reserve1 === 0n ? 1n : reserve1);
      liquidity = l0 < l1 ? l0 : l1;
    }
    setLpMintOutText(formatUnitsToDecimalText(liquidity, 18));

    // 交易后储备应为：当前储备 + 当前 amountTokenOptimal（根据显示选择，毛值或净值）
    const addAForReserves = applyOptimalNetDisplay ? effectiveA : depositA;
    const addBForReserves = applyOptimalNetDisplay ? effectiveB : depositB;
    setPostReserve0(reserve0 + addAForReserves);
    setPostReserve1(reserve1 + addBForReserves);
    if (optimal.init) {
      // 初始池：无最优比，按输入即可
      setAmount0OptimalText('');
      setAmount1OptimalText('');
    } else if (optimal.amountBOptimal !== undefined) {
      const showVal = applyOptimalNetDisplay
        ? (optimal.amountBOptimal * feeMultiplier) / feeBasis
        : optimal.amountBOptimal;
      setAmount1OptimalText(formatUnitsToDecimalText(showVal, token1Decimals));
      setAmount0OptimalText('');
    } else if (optimal.amountAOptimal !== undefined) {
      const showVal = applyOptimalNetDisplay
        ? (optimal.amountAOptimal * feeMultiplier) / feeBasis
        : optimal.amountAOptimal;
      setAmount0OptimalText(formatUnitsToDecimalText(showVal, token0Decimals));
      setAmount1OptimalText('');
    } else {
      setAmount0OptimalText('');
      setAmount1OptimalText('');
    }
  }, [token0Decimals, token1Decimals, reserve0, reserve1, totalSupply, intSqrt, withFee, applyOptimalNetDisplay]);

  // 当手续费开关变更时，如果当前处于 LP 铸造场景，则重新计算最优数量展示
  useEffect(() => {
    if (lastDirection === 'lpMint') {
      recalcMint(mint0InText, mint1InText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withFee]);

  // 当“显示净值”切换时，保持 LP 场景的交易后储备与 LP 计算同步
  useEffect(() => {
    if (lastDirection === 'lpMint') {
      recalcMint(mint0InText, mint1InText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyOptimalNetDisplay]);

  const simulateMint0Change = useCallback((text: string) => {
    setMint0InText(text);
    recalcMint(text, mint1InText);
  }, [recalcMint, mint1InText]);

  const simulateMint1Change = useCallback((text: string) => {
    setMint1InText(text);
    recalcMint(mint0InText, text);
  }, [recalcMint, mint0InText]);

  // 移除 LP：输入 LP 数量，计算可得 t0 与 t1
  const simulateBurnLP = useCallback((text: string) => {
    setLpBurnInText(text);
    setLastDirection('lpBurn');
    const liq = parseUnitsFromDecimalText(text, 18);
    if (liq <= 0n || totalSupply <= 0n || reserve0 <= 0n || reserve1 <= 0n) {
      setBurn0OutText('');
      setBurn1OutText('');
      setPostReserve0(reserve0);
      setPostReserve1(reserve1);
      return;
    }
    const a0 = (liq * reserve0) / totalSupply;
    const a1 = (liq * reserve1) / totalSupply;
    setBurn0OutText(formatUnitsToDecimalText(a0, token0Decimals));
    setBurn1OutText(formatUnitsToDecimalText(a1, token1Decimals));
    setPostReserve0(reserve0 - a0);
    setPostReserve1(reserve1 - a1);
  }, [reserve0, reserve1, totalSupply, token0Decimals, token1Decimals]);

  // 目标输出→所需输入：得到 t1 多少，需要输入 t0 多少
  const simulateDesired1Out = useCallback(
    (text: string) => {
      setDesired1OutText(text);
      setLastDirection('desired1');
      const amountOut = parseUnitsFromDecimalText(text, token1Decimals);
      if (amountOut <= 0n || reserve0 <= 0n || reserve1 <= 0n || amountOut >= reserve1) {
        setRequired0InText('');
        setPostReserve0(reserve0);
        setPostReserve1(reserve1);
        return;
      }
      const amountIn = getAmountIn(amountOut, reserve0, reserve1, withFee);
      setRequired0InText(formatUnitsToDecimalText(amountIn, token0Decimals));
      const effectiveIn = withFee ? (amountIn * feeMultiplier) / feeBasis : amountIn;
      setPostReserve0(reserve0 + effectiveIn);
      setPostReserve1(reserve1 - amountOut);
    },
    [token0Decimals, token1Decimals, reserve0, reserve1, withFee, feeMultiplier]
  );

  // 目标输出→所需输入：得到 t0 多少，需要输入 t1 多少
  const simulateDesired0Out = useCallback(
    (text: string) => {
      setDesired0OutText(text);
      setLastDirection('desired0');
      const amountOut = parseUnitsFromDecimalText(text, token0Decimals);
      if (amountOut <= 0n || reserve0 <= 0n || reserve1 <= 0n || amountOut >= reserve0) {
        setRequired1InText('');
        setPostReserve0(reserve0);
        setPostReserve1(reserve1);
        return;
      }
      const amountIn = getAmountIn(amountOut, reserve1, reserve0, withFee);
      setRequired1InText(formatUnitsToDecimalText(amountIn, token1Decimals));
      const effectiveIn = withFee ? (amountIn * feeMultiplier) / feeBasis : amountIn;
      setPostReserve1(reserve1 + effectiveIn);
      setPostReserve0(reserve0 - amountOut);
    },
    [token0Decimals, token1Decimals, reserve0, reserve1, withFee, feeMultiplier]
  );

  const k = useMemo(() => reserve0 * reserve1, [reserve0, reserve1]);

  // 当基数（储备）更新后，根据最后一次方向重新计算，满足“应用结果为基数→继续下一轮”
  useEffect(() => {
    switch (lastDirection) {
      case '0to1':
        if (amount0InText) simulateToken0To1(amount0InText);
        break;
      case '1to0':
        if (amount1InText) simulateToken1To0(amount1InText);
        break;
      case 'desired1':
        if (desired1OutText) simulateDesired1Out(desired1OutText);
        break;
      case 'desired0':
        if (desired0OutText) simulateDesired0Out(desired0OutText);
        break;
      case 'lpMint':
        if (mint0InText || mint1InText) recalcMint(mint0InText, mint1InText);
        break;
      case 'lpBurn':
        if (lpBurnInText) simulateBurnLP(lpBurnInText);
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reserve0, reserve1]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="模拟计算器" />
      <main className="max-w-6xl mx-auto p-6 text-gray-800">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">模拟计算器</h1>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* 左侧导航 */}
          <div className="md:col-span-3">
            <DeFiNavigation />
          </div>
          {/* 主要内容 */}
          <div className="md:col-span-9 space-y-6">

        {/* Pair选择与紧凑设置 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-6">
              <label className="block text-sm text-gray-700 mb-2">交易池地址</label>
              <UnifiedAddressSelector
                value={pairAddress}
                onChange={(addr) => setPairAddress(addr)}
                placeholder="从交易池别名选择或输入 Pair 地址..."
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm text-gray-700 mb-2">网络</label>
              <select value={network} onChange={(e) => setNetwork(e.target.value as any)} className="w-full px-3 py-2 border rounded">
                <option value="fork">Fork</option>
                <option value="bsc">BSC</option>
                <option value="ethereum">Ethereum</option>
                <option value="polygon">Polygon</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm text-gray-700 mb-2">手续费</label>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={withFee} onChange={(e) => setWithFee(e.target.checked)} />
                <span className="text-sm text-gray-600">考虑 0.25% 费用</span>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <button className="text-xs text-gray-600 hover:text-gray-900" onClick={() => setShowAdvanced((s) => !s)}>
              {showAdvanced ? '隐藏高级设置' : '显示高级设置（精度/别名）'}
            </button>
          </div>
          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-3">
              <div className="md:col-span-3">
                <label className="block text-xs text-gray-600 mb-1">Token0 精度</label>
                <input type="number" value={token0Decimals} onChange={(e) => setToken0Decimals(Number(e.target.value))} className="w-full px-2 py-1 border rounded" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs text-gray-600 mb-1">Token1 精度</label>
                <input type="number" value={token1Decimals} onChange={(e) => setToken1Decimals(Number(e.target.value))} className="w-full px-2 py-1 border rounded" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs text-gray-600 mb-1">Token0 别名</label>
                <input type="text" value={alias0} onChange={(e) => setAlias0(e.target.value)} className="w-full px-2 py-1 border rounded" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs text-gray-600 mb-1">Token1 别名</label>
                <input type="text" value={alias1} onChange={(e) => setAlias1(e.target.value)} className="w-full px-2 py-1 border rounded" />
              </div>
            </div>
          )}
        </div>

        {/* 当前储备与价格 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6 md:col-span-2">
            <div className="text-sm text-gray-600">{alias0} (t0) 当前储备</div>
            <div className="text-lg font-mono mb-2">{format(reserve0, { decimals: token0Decimals, thousandSep: true })}</div>
            <div className="text-sm text-gray-600">{alias1} (t1) 当前储备</div>
            <div className="text-lg font-mono">{format(reserve1, { decimals: token1Decimals, thousandSep: true })}</div>

            {/* 手动编辑储备 */}
            <div className="mt-4">
              <div className="text-gray-800 font-semibold mb-2">手动调整储备（不从链上读取）</div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">{alias0} (t0)</label>
                  <input
                    type="text"
                    value={manualReserve0Text}
                    onChange={(e) => setManualReserve0Text(e.target.value)}
                    placeholder={`按 ${token0Decimals} 位小数`}
                    className="w-full px-3 py-2 border rounded font-mono"
                  />
                  <div className="mt-1 text-xs text-gray-500">示例：1000 或 0.5</div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">{alias1} (t1)</label>
                  <input
                    type="text"
                    value={manualReserve1Text}
                    onChange={(e) => setManualReserve1Text(e.target.value)}
                    placeholder={`按 ${token1Decimals} 位小数`}
                    className="w-full px-3 py-2 border rounded font-mono"
                  />
                  <div className="mt-1 text-xs text-gray-500">示例：1000000 或 2500</div>
                </div>
              </div>
              <div className="mt-3 flex gap-3">
                <button
                  className="px-3 py-1 text-xs bg-gray-800 text-white rounded hover:bg-black"
                  onClick={applyManualReserves}
                  disabled={!manualReserve0Text || !manualReserve1Text}
                >
                  应用手动储备为当前基数
                </button>
                <button
                  className="px-3 py-1 text-xs bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  onClick={resetReservesFromChain}
                >
                  重置为链上储备
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-600">提示：应用后，后续模拟将以你设置的储备为基数。</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-gray-800 font-semibold mb-2">价格与 K</div>
            <div className="text-sm text-gray-600">1 {alias0} (t0) : <span className="font-mono">{price0}</span> (t1)</div>
            <div className="text-sm text-gray-600 mt-1">1 {alias1} (t1) : <span className="font-mono">{price1}</span> (t0)</div>
            <div className="text-xs text-gray-500 mt-1">K = {formatLargeNumber(k)}</div>
          </div>
        </div>

        {/* 直接输入输出模拟 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-gray-800 font-semibold mb-2">输入 {alias0} (t0) → 输出 {alias1} (t1)</div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-sm text-gray-700 mb-1">输入 {alias0}</label>
                <input
                  type="text"
                  value={amount0InText}
                  onChange={(e) => simulateToken0To1(e.target.value)}
                  placeholder={`按 ${token0Decimals} 位小数`}
                  className="w-full px-3 py-2 border rounded font-mono"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">可得 {alias1}</label>
                <input
                  type="text"
                  value={amount1OutText}
                  readOnly
                  className="w-full px-3 py-2 border rounded bg-gray-50 font-mono"
                />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600">交易后储备：
              <span className="ml-2">{alias0} (t0): {format(postReserve0, { decimals: token0Decimals, thousandSep: true })}</span>
              <span className="ml-3">{alias1} (t1): {format(postReserve1, { decimals: token1Decimals, thousandSep: true })}</span>
            </div>
            <div className="mt-3">
              <button
                className="px-3 py-1 text-xs bg-gray-800 text-white rounded hover:bg-black"
                onClick={() => {
                  setReserve0(postReserve0);
                  setReserve1(postReserve1);
                }}
                disabled={!amount0InText || !amount1OutText}
              >
                应用结果为基数
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-gray-800 font-semibold mb-2">输入 {alias1} (t1) → 输出 {alias0} (t0)</div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-sm text-gray-700 mb-1">输入 {alias1}</label>
                <input
                  type="text"
                  value={amount1InText}
                  onChange={(e) => simulateToken1To0(e.target.value)}
                  placeholder={`按 ${token1Decimals} 位小数`}
                  className="w-full px-3 py-2 border rounded font-mono"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">可得 {alias0}</label>
                <input
                  type="text"
                  value={amount0OutText}
                  readOnly
                  className="w-full px-3 py-2 border rounded bg-gray-50 font-mono"
                />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600">交易后储备：
              <span className="ml-2">{alias0} (t0): {format(postReserve0, { decimals: token0Decimals, thousandSep: true })}</span>
              <span className="ml-3">{alias1} (t1): {format(postReserve1, { decimals: token1Decimals, thousandSep: true })}</span>
            </div>
            <div className="mt-3">
              <button
                className="px-3 py-1 text-xs bg-gray-800 text-white rounded hover:bg-black"
                onClick={() => {
                  setReserve0(postReserve0);
                  setReserve1(postReserve1);
                }}
                disabled={!amount1InText || !amount0OutText}
              >
                应用结果为基数
              </button>
            </div>
          </div>
        </div>

        {/* 目标输出 → 所需输入 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-gray-800 font-semibold mb-2">目标输出 {alias1} (t1) → 所需输入 {alias0} (t0)</div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-sm text-gray-700 mb-1">想要得到 {alias1}</label>
                <input
                  type="text"
                  value={desired1OutText}
                  onChange={(e) => simulateDesired1Out(e.target.value)}
                  placeholder={`按 ${token1Decimals} 位小数`}
                  className="w-full px-3 py-2 border rounded font-mono"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">需要输入 {alias0}</label>
                <input
                  type="text"
                  value={required0InText}
                  readOnly
                  className="w-full px-3 py-2 border rounded bg-gray-50 font-mono"
                />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600">交易后储备：
              <span className="ml-2">{alias0} (t0): {format(postReserve0, { decimals: token0Decimals, thousandSep: true })}</span>
              <span className="ml-3">{alias1} (t1): {format(postReserve1, { decimals: token1Decimals, thousandSep: true })}</span>
            </div>
            <div className="mt-3">
              <button
                className="px-3 py-1 text-xs bg-gray-800 text-white rounded hover:bg-black"
                onClick={() => {
                  setReserve0(postReserve0);
                  setReserve1(postReserve1);
                }}
                disabled={!desired1OutText || !required0InText}
              >
                应用结果为基数
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-gray-800 font-semibold mb-2">目标输出 {alias0} (t0) → 所需输入 {alias1} (t1)</div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-sm text-gray-700 mb-1">想要得到 {alias0}</label>
                <input
                  type="text"
                  value={desired0OutText}
                  onChange={(e) => simulateDesired0Out(e.target.value)}
                  placeholder={`按 ${token0Decimals} 位小数`}
                  className="w-full px-3 py-2 border rounded font-mono"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">需要输入 {alias1}</label>
                <input
                  type="text"
                  value={required1InText}
                  readOnly
                  className="w-full px-3 py-2 border rounded bg-gray-50 font-mono"
                />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600">交易后储备：
              <span className="ml-2">{alias0} (t0): {format(postReserve0, { decimals: token0Decimals, thousandSep: true })}</span>
              <span className="ml-3">{alias1} (t1): {format(postReserve1, { decimals: token1Decimals, thousandSep: true })}</span>
            </div>
            <div className="mt-3">
              <button
                className="px-3 py-1 text-xs bg-gray-800 text-white rounded hover:bg-black"
                onClick={() => {
                  setReserve0(postReserve0);
                  setReserve1(postReserve1);
                }}
                disabled={!desired0OutText || !required1InText}
              >
                应用结果为基数
              </button>
            </div>
          </div>
        </div>

        {/* 说明 */}
        <div className="bg-white rounded-lg shadow-md p-6 text-xs text-gray-600">
          <p>提示：此处为恒定乘积 AMM 模型模拟计算，不执行真实交易；别名与精度可在“高级设置”中调整，价格不包含手续费。</p>
        </div>

        {/* 按固定比例添加流动性 → 获得 LP 数量 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-gray-800 font-semibold mb-2">按固定比例添加流动性 → 获得 LP</div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-sm text-gray-700 mb-1">输入 {alias0} (t0)</label>
                <input
                  type="text"
                  value={mint0InText}
                  onChange={(e) => simulateMint0Change(e.target.value)}
                  placeholder={`按 ${token0Decimals} 位小数`}
                  className="w-full px-3 py-2 border rounded font-mono"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">输入 {alias1} (t1)</label>
                <input
                  type="text"
                  value={mint1InText}
                  onChange={(e) => simulateMint1Change(e.target.value)}
                  placeholder={`按 ${token1Decimals} 位小数`}
                  className="w-full px-3 py-2 border rounded font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end mt-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">可铸造 LP</label>
                <input
                  type="text"
                  value={lpMintOutText}
                  readOnly
                  className="w-full px-3 py-2 border rounded bg-gray-50 font-mono"
                />
              </div>
              <div className="text-xs text-gray-600">
                <div>当前 LP 总量: <span className="font-mono">{format(totalSupply, { decimals: 18, thousandSep: true })}</span></div>
              </div>
            </div>
            {/* 最优数量建议（amountTokenOptimal 显示） */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end mt-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">amountTokenOptimal (t0)</label>
                <input
                  type="text"
                  value={amount0OptimalText}
                  readOnly
                  placeholder="当以 t1 为基准时建议的 t0"
                  className="w-full px-3 py-2 border rounded bg-gray-50 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">amountTokenOptimal (t1)</label>
                <input
                  type="text"
                  value={amount1OptimalText}
                  readOnly
                  placeholder="当以 t0 为基准时建议的 t1"
                  className="w-full px-3 py-2 border rounded bg-gray-50 font-mono"
                />
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-700 flex items-center gap-2">
              <input
                type="checkbox"
                checked={applyOptimalNetDisplay}
                onChange={(e) => setApplyOptimalNetDisplay(e.target.checked)}
              />
              <span>显示净值（amountTokenOptimal × 0.9975）</span>
            </div>
            <div className="mt-3 text-xs text-gray-600">交易后储备：
              <span className="ml-2">{alias0} (t0): {format(postReserve0, { decimals: token0Decimals, thousandSep: true })}</span>
              <span className="ml-3">{alias1} (t1): {format(postReserve1, { decimals: token1Decimals, thousandSep: true })}</span>
            </div>
            <div className="mt-3">
              <button
                className="px-3 py-1 text-xs bg-gray-800 text-white rounded hover:bg-black"
                onClick={() => {
                  // 应用储备与 LP 总量变更
                  const a0 = parseUnitsFromDecimalText(mint0InText, token0Decimals);
                  const a1 = parseUnitsFromDecimalText(mint1InText, token1Decimals);
                  let liquidity: bigint = 0n;
                  if (lpMintOutText) {
                    try { liquidity = parseUnitsFromDecimalText(lpMintOutText, 18); } catch (_) {}
                  }
                  setReserve0(postReserve0);
                  setReserve1(postReserve1);
                  if (liquidity > 0n) setTotalSupply(totalSupply + liquidity);
                }}
                disabled={!lpMintOutText || !mint0InText || !mint1InText}
              >
                应用结果为基数
              </button>
            </div>
          </div>

          {/* 移除 LP → 可得 Token0/Token1 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-gray-800 font-semibold mb-2">移除 LP → 获得 {alias0}/{alias1}</div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-sm text-gray-700 mb-1">移除 LP 数量</label>
                <input
                  type="text"
                  value={lpBurnInText}
                  onChange={(e) => simulateBurnLP(e.target.value)}
                  placeholder={`按 18 位小数`}
                  className="w-full px-3 py-2 border rounded font-mono"
                />
              </div>
              <div className="text-xs text-gray-600">
                <div>当前 LP 总量: <span className="font-mono">{format(totalSupply, { decimals: 18, thousandSep: true })}</span></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end mt-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">可得 {alias0} (t0)</label>
                <input
                  type="text"
                  value={burn0OutText}
                  readOnly
                  className="w-full px-3 py-2 border rounded bg-gray-50 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">可得 {alias1} (t1)</label>
                <input
                  type="text"
                  value={burn1OutText}
                  readOnly
                  className="w-full px-3 py-2 border rounded bg-gray-50 font-mono"
                />
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600">交易后储备：
              <span className="ml-2">{alias0} (t0): {format(postReserve0, { decimals: token0Decimals, thousandSep: true })}</span>
              <span className="ml-3">{alias1} (t1): {format(postReserve1, { decimals: token1Decimals, thousandSep: true })}</span>
            </div>
            <div className="mt-3">
              <button
                className="px-3 py-1 text-xs bg-gray-800 text-white rounded hover:bg-black"
                onClick={() => {
                  const liq = parseUnitsFromDecimalText(lpBurnInText, 18);
                  setReserve0(postReserve0);
                  setReserve1(postReserve1);
                  if (liq > 0n) setTotalSupply(totalSupply - liq);
                }}
                disabled={!lpBurnInText || !burn0OutText || !burn1OutText}
              >
                应用结果为基数
              </button>
            </div>
          </div>
        </div>
          </div>
        </div>
      </main>
    </div>
  );
}