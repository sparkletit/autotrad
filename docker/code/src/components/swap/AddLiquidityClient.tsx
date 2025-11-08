'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import DeFiNavigation from '@/components/swap/DeFiNavigation';
import UnifiedAddressSelector from '@/components/common/UnifiedAddressSelector';
import { fetchCustomTokens } from '@/lib/addressService';
import { parseUnits, formatUnits } from 'viem';

interface CustomToken {
  symbol: string;
  address: string;
  decimals: number;
}

const AddLiquidityClient: React.FC = () => {
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('fork');
  const [tokens, setTokens] = useState<CustomToken[]>([]);

  const [tokenA, setTokenA] = useState('');
  const [tokenB, setTokenB] = useState('');
  const [amountADesired, setAmountADesired] = useState('');
  const [amountBDesired, setAmountBDesired] = useState('');
  const [amountAMin, setAmountAMin] = useState('');
  const [amountBMin, setAmountBMin] = useState('');
  const [slippage, setSlippage] = useState<'auto' | '0.5' | '5' | '10'>('auto');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [txHash, setTxHash] = useState('');

  useEffect(() => {
    const loadTokens = async () => {
      const list = await fetchCustomTokens();
      setTokens(list.map((t: any) => ({ symbol: t.symbol, address: t.address || t.contract_address, decimals: t.decimals })));
    };
    loadTokens();
  }, []);

  // 根据 TokenA/TokenB 获取 Pair 储备，用于按比例计算另一侧数量
  const [pairInfo, setPairInfo] = useState<{ pairAddress?: string; token0?: string; token1?: string; reserve0?: string; reserve1?: string } | null>(null);

  useEffect(() => {
    const fetchPair = async () => {
      setPairInfo(null);
      if (!tokenA || !tokenB) return;
      try {
        const resp = await fetch('/api/swap/get-pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokenA, tokenB, network: selectedNetwork }),
        });
        const data = await resp.json();
        if (data.success && data.data?.pairAddress) {
          setPairInfo({
            pairAddress: data.data.pairAddress,
            token0: data.data.token0,
            token1: data.data.token1,
            reserve0: data.data.reserve0,
            reserve1: data.data.reserve1,
          });
        }
      } catch (e) {
        // 静默失败，仅用于辅助计算
      }
    };
    fetchPair();
  }, [tokenA, tokenB, selectedNetwork]);

  // 单边输入时，依据当前储备比例自动计算另一边数量（按各自 decimals 处理）
  useEffect(() => {
    if (!pairInfo?.reserve0 || !pairInfo?.reserve1 || !tokenA || !tokenB) return;
    const r0 = BigInt(pairInfo.reserve0);
    const r1 = BigInt(pairInfo.reserve1);
    if (r0 === 0n || r1 === 0n) return;

    const aIsToken0 = pairInfo.token0 && tokenA && pairInfo.token0.toLowerCase() === tokenA.toLowerCase();
    const reserveA = aIsToken0 ? r0 : r1;
    const reserveB = aIsToken0 ? r1 : r0;

    const tokenADecimals = tokens.find((t) => t.address.toLowerCase() === tokenA.toLowerCase())?.decimals ?? 18;
    const tokenBDecimals = tokens.find((t) => t.address.toLowerCase() === tokenB.toLowerCase())?.decimals ?? 18;

    const calcOther = (inputStr: string, isA: boolean): string | null => {
      if (!inputStr || Number(inputStr) <= 0) return null;
      try {
        const inputRaw = parseUnits(inputStr, isA ? tokenADecimals : tokenBDecimals);
        const outRaw = isA
          ? (inputRaw * reserveB) / reserveA
          : (inputRaw * reserveA) / reserveB;
        const outHuman = formatUnits(outRaw, isA ? tokenBDecimals : tokenADecimals);
        return outHuman;
      } catch {
        return null;
      }
    };

    // 若 A 有值且 B 为空，则计算 B；反之亦然
    if (amountADesired && !amountBDesired) {
      const other = calcOther(amountADesired, true);
      if (other) setAmountBDesired(other);
    } else if (amountBDesired && !amountADesired) {
      const other = calcOther(amountBDesired, false);
      if (other) setAmountADesired(other);
    }
  }, [amountADesired, amountBDesired, tokenA, tokenB, pairInfo, tokens]);

  const handleSubmit = async () => {
    if (!fromAddress || !tokenA || !tokenB || !amountADesired || !amountBDesired) {
      setError('请填写必填项：账户、TokenA、TokenB、数量');
      return;
    }
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setTxHash('');

      const body = {
        account: fromAddress,
        toAddress: toAddress || undefined,
        tokenA,
        tokenB,
        amountADesired,
        amountBDesired,
        amountAMin: amountAMin || undefined,
        amountBMin: amountBMin || undefined,
        slippage,
        network: selectedNetwork,
      };

      const resp = await fetch('/api/swap/add-liquidity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (data.success) {
        setSuccess(data.data?.message || '提交成功');
        setTxHash(data.data?.txHash || '');
      } else {
        setError(data.error || '提交失败');
        setTxHash(data.data?.txHash || '');
      }
    } catch (e: any) {
      setError(e?.message || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="添加流动性" />
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">添加流动性</h1>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-3">
              <DeFiNavigation />
            </div>
            <div className="md:col-span-9 space-y-6">
              {/* 账户与网络 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">账户与网络</h2>
                {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4"><p className="text-sm text-red-800">{error}</p></div>}
                {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4"><p className="text-sm text-green-800">{success}</p>{txHash && <p className="text-xs text-green-700 font-mono mt-2 break-all">TX: {txHash}</p>}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">账户 *</label>
                    <UnifiedAddressSelector value={fromAddress} onChange={setFromAddress} placeholder="选择或输入账户..." />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">接收地址 (默认同账户)</label>
                    <UnifiedAddressSelector value={toAddress} onChange={setToAddress} placeholder="选择或输入接收地址..." />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">网络</label>
                  <select value={selectedNetwork} onChange={(e) => setSelectedNetwork(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-sm text-gray-900">
                    <option value="fork">Fork (本地)</option>
                    <option value="bsc">BSC</option>
                    <option value="ethereum">Ethereum</option>
                    <option value="polygon">Polygon</option>
                  </select>
                </div>
              </div>

              {/* Token 选择与数量 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">代币与数量</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Token A *</label>
                    <select value={tokenA} onChange={(e) => setTokenA(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900">
                      <option value="">-- 选择代币 --</option>
                      {tokens.map((t) => (
                        <option key={t.address} value={t.address}>{t.symbol} ({t.address.slice(0,6)}...)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Token B *</label>
                    <select value={tokenB} onChange={(e) => setTokenB(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900">
                      <option value="">-- 选择代币 --</option>
                      {tokens.map((t) => (
                        <option key={t.address} value={t.address}>{t.symbol} ({t.address.slice(0,6)}...)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Token A 数量 *</label>
                    <input type="number" value={amountADesired} onChange={(e) => setAmountADesired(e.target.value)} step="0.0001" min="0" placeholder="输入数量（单边输入自动计算另一侧）" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Token B 数量 *</label>
                    <input type="number" value={amountBDesired} onChange={(e) => setAmountBDesired(e.target.value)} step="0.0001" min="0" placeholder="输入数量（单边输入自动计算另一侧）" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                  </div>
                </div>
                {pairInfo?.pairAddress && (
                  <div className="mt-3 text-xs text-gray-600">
                    <span className="font-mono">Pair: {pairInfo.pairAddress}</span>
                    <span className="ml-2">Reserves: R0 {pairInfo.reserve0} / R1 {pairInfo.reserve1}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Token A 最小数量 (可选)</label>
                    <input type="number" value={amountAMin} onChange={(e) => setAmountAMin(e.target.value)} step="0.0001" min="0" placeholder="留空将按滑点自动计算" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Token B 最小数量 (可选)</label>
                    <input type="number" value={amountBMin} onChange={(e) => setAmountBMin(e.target.value)} step="0.0001" min="0" placeholder="留空将按滑点自动计算" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">滑点</label>
                  <div className="flex gap-2">
                    {(['auto','0.5','5','10'] as const).map((opt) => (
                      <button key={opt} onClick={() => setSlippage(opt)} className={`px-3 py-1 rounded ${slippage===opt? 'bg-blue-600 text-white':'bg-gray-200 text-gray-700'}`}>{opt==='auto'?'Auto':`${opt}%`}</button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={handleSubmit} disabled={loading || !fromAddress || !tokenA || !tokenB || !amountADesired || !amountBDesired} className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg">{loading?'提交中...':'确认添加流动性'}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddLiquidityClient;