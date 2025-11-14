'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import DeFiNavigation from '@/components/swap/DeFiNavigation';
import UnifiedAddressSelector from '@/components/common/UnifiedAddressSelector';
import apiService from '@/lib/apiService';
import { queryReserves, removeLiquidity } from '@/lib/swapService';
import { formatUnits } from 'viem';

const RemoveLiquidityClient: React.FC = () => {
  const [account, setAccount] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [pairAddress, setPairAddress] = useState('');
  const [liquidity, setLiquidity] = useState('');
  const [amountAMin, setAmountAMin] = useState('');
  const [amountBMin, setAmountBMin] = useState('');
  const [slippage, setSlippage] = useState<'auto' | '0.5' | '5' | '10'>('auto');
  const [network, setNetwork] = useState('fork');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [txHash, setTxHash] = useState('');

  // 当选择账户或交易池地址变化时，自动查询 LP 余额并填入数量
  useEffect(() => {
    const autoFillLPBalance = async () => {
      if (!account || !pairAddress || !pairAddress.match(/^0x[a-fA-F0-9]{40}$/)) return;
      try {
        const { success, data } = await queryReserves({ pairAddress, network, account });
        if (success) {
          const lpBalanceWei = (data as any)?.lpBalance || (data as any)?.lpBalance || '0';
          // 将原始 Wei 单位转换为人类单位（18位）以便展示与提交
          try {
            const humanReadable = formatUnits(BigInt(lpBalanceWei), 18);
            setLiquidity(humanReadable);
          } catch {
            // 兜底：若转换失败，仍填入原始字符串
            setLiquidity(lpBalanceWei);
          }
        }
      } catch (e) {
        // 静默失败，不影响表单填写
      }
    };
    autoFillLPBalance();
  }, [account, pairAddress, network]);

  const handleSubmit = async () => {
    if (!account || !pairAddress || !liquidity) {
      setError('请填写必填项：账户、交易对地址、LP 数量');
      return;
    }
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setTxHash('');

      const body = {
        account,
        toAddress: toAddress || undefined,
        pairAddress,
        liquidity,
        amountAMin: amountAMin || undefined,
        amountBMin: amountBMin || undefined,
        slippage,
        network,
      };

      const { success, data, error } = await removeLiquidity(body);
      if (success) {
        setSuccess(((data as any)?.message) || '提交成功');
        setTxHash(((data as any)?.txHash) || '');
      } else {
        setError(error || '提交失败');
        setTxHash(((data as any)?.txHash) || '');
      }
    } catch (e: any) {
      setError(e?.message || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="移除流动性" />
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">移除流动性</h1>

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
                    <UnifiedAddressSelector value={account} onChange={setAccount} placeholder="选择或输入账户..." />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">接收地址 (默认同账户)</label>
                    <UnifiedAddressSelector value={toAddress} onChange={setToAddress} placeholder="选择或输入接收地址..." />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">网络</label>
                  <select value={network} onChange={(e) => setNetwork(e.target.value)} className="px-3 py-2 border border-gray-300 rounded text-sm text-gray-900">
                    <option value="fork">Fork (本地)</option>
                    <option value="bsc">BSC</option>
                    <option value="ethereum">Ethereum</option>
                    <option value="polygon">Polygon</option>
                  </select>
                </div>
              </div>

              {/* 交易对与数量 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">交易对与 LP 数量</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">交易池地址 *</label>
                    <UnifiedAddressSelector
                      value={pairAddress}
                      onChange={(addr) => setPairAddress(addr)}
                      placeholder="从交易池别名选择或输入 LP Pair 地址..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">LP Token 数量 *</label>
                    <input
                      type="text"
                      value={liquidity}
                      onChange={(e) => setLiquidity(e.target.value)}
                      placeholder="自动填入当前账户的 LP 余额（人类单位）"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">提示：LP 数量为人类单位（按18位小数转换）；从上方账户与交易池自动查询余额。</p>
                  </div>
                </div>
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

              <button onClick={handleSubmit} disabled={loading || !account || !pairAddress || !liquidity} className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg">{loading?'提交中...':'确认移除流动性'}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RemoveLiquidityClient;
