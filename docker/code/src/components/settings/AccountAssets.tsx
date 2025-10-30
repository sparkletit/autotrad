'use client';

import React, { useState, useEffect } from 'react';

interface Asset {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  contractAddress?: string;
  logoUrl?: string;
  formatted?: string;
}

interface AccountAssetsProps {
  address: string;
}

export default function AccountAssets({ address }: AccountAssetsProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 获取账户资产信息
  const fetchAssets = async () => {
    if (!address) return;

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/account-assets/${address}`);
      const data = await response.json();

      if (data.success) {
        setAssets(data.data || []);
      } else {
        setError(data.error || '获取资产信息失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取资产信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (address) {
      fetchAssets();
    }
  }, [address]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">主网资产</h2>
        <button
          onClick={fetchAssets}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? '加载中...' : '刷新'}
        </button>
      </div>

      {/* 账户地址 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600 mb-1">账户地址</p>
        <p className="text-sm font-mono text-gray-900 break-all">{address}</p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* 资产列表 */}
      {loading ? (
        <p className="text-center text-gray-600 py-8">加载资产中...</p>
      ) : assets.length === 0 ? (
        <p className="text-center text-gray-600 py-8">
          暂无资产信息。请确保账户在主网上有资产。
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  资产名称
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  符号
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  余额
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                  合约地址
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {assets.map((asset, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{asset.name}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {asset.symbol}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 font-mono">
                    {asset.formatted || '0'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                    {asset.contractAddress ? (
                      <span className="break-all text-xs">{asset.contractAddress}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
