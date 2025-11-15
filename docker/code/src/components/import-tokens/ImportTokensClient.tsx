'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@/components/common/Alert';

interface ValidationResult {
  valid: string[];
  invalid: string[];
}

const CHAINS = [
  { id: 'bsc', name: 'Binance Smart Chain (BSC)', symbol: 'BNB' },
  { id: 'eth', name: 'Ethereum (ETH)', symbol: 'ETH' },
  { id: 'polygon', name: 'Polygon (MATIC)', symbol: 'MATIC' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH' },
  { id: 'optimism', name: 'Optimism', symbol: 'ETH' }
];

const COLORS = [
  { value: 'red', label: '红色', class: 'bg-red-500' },
  { value: 'yellow', label: '黄色', class: 'bg-yellow-500' },
  { value: 'blue', label: '蓝色', class: 'bg-blue-500' },
  { value: 'green', label: '绿色', class: 'bg-green-500' },
  { value: 'purple', label: '紫色', class: 'bg-purple-500' }
];

export default function ImportTokensClient() {
  const router = useRouter();
  const [selectedChain, setSelectedChain] = useState('bsc');
  const [addresses, setAddresses] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // 验证地址格式
  const validateAddresses = (addressList: string[]): ValidationResult => {
    const valid: string[] = [];
    const invalid: string[] = [];
    
    addressList.forEach(addr => {
      const trimmedAddr = addr.trim();
      if (trimmedAddr) {
        // 基本的以太坊地址验证（0x开头，40个十六进制字符）
        const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmedAddr);
        if (isValidAddress) {
          valid.push(trimmedAddr.toLowerCase());
        } else {
          invalid.push(trimmedAddr);
        }
      }
    });

    return { valid, invalid };
  };

  // 导入代币地址
  const handleImport = async () => {
    if (!addresses.trim()) {
      setAlert({ type: 'error', message: '请输入代币地址' });
      return;
    }

    const addressList = addresses.split('\n').filter(addr => addr.trim());
    const validation = validateAddresses(addressList);

    if (validation.valid.length === 0) {
      setAlert({ type: 'error', message: '没有有效的代币地址' });
      return;
    }

    setIsImporting(true);
    setAlert({ type: 'info', message: `正在导入 ${validation.valid.length} 个代币地址...` });

    try {
      const response = await fetch('/api/import-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chain: selectedChain,
          addresses: validation.valid,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setAlert({ 
          type: 'success', 
          message: `成功导入 ${result.inserted} 个代币地址${result.duplicates > 0 ? `，跳过 ${result.duplicates} 个重复地址` : ''}` 
        });
        setAddresses('');
        
        // 2秒后跳转到列表页面
        setTimeout(() => {
          router.push('/import-tokens-list');
        }, 2000);
      } else {
        setAlert({ type: 'error', message: result.error || '导入失败' });
      }
    } catch (error) {
      setAlert({ type: 'error', message: '网络错误，请重试' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-gray-600">
        <div className="bg-white shadow-lg rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">批量导入代币地址</h1>
            <p className="mt-1 text-sm text-gray-700">选择区块链网络并批量导入代币合约地址</p>
          </div>

          <div className="px-6 py-6">
            {alert && (
              <div className="mb-6">
                <Alert 
                  type={alert.type} 
                  message={alert.message} 
                  onClose={() => setAlert(null)} 
                />
              </div>
            )}

            {/* 链选择器 */}
            <div className="mb-6">
              <label htmlFor="chain-select" className="block text-sm font-medium text-gray-700 mb-2">
                选择区块链网络
              </label>
              <select
                id="chain-select"
                value={selectedChain}
                onChange={(e) => setSelectedChain(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {CHAINS.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name} ({chain.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* 地址输入区域 */}
            <div className="mb-6">
              <label htmlFor="addresses" className="block text-sm font-medium text-gray-700 mb-2">
                代币地址列表
              </label>
              <textarea
                id="addresses"
                rows={12}
                value={addresses}
                onChange={(e) => setAddresses(e.target.value)}
                placeholder="请粘贴代币合约地址，每行一个地址&#10;例如：&#10;0x1234567890123456789012345678901234567890&#10;0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              />
              <p className="mt-2 text-sm text-gray-600">
                已输入 {addresses.split('\n').filter(addr => addr.trim()).length} 个地址
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleImport}
                disabled={isImporting || !addresses.trim()}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isImporting ? '导入中...' : '导入代币地址'}
              </button>
              
              <button
                onClick={() => router.push('/import-tokens-list')}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                查看代币列表
              </button>
            </div>
          </div>
        </div>

        {/* 地址格式说明 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">地址格式要求</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 地址必须以 0x 开头</li>
            <li>• 地址必须是 40 个十六进制字符（0-9, a-f, A-F）</li>
            <li>• 每行输入一个地址</li>
                <li>• 系统会自动过滤无效地址</li>
              </ul>
            </div>
            
            {/* 快速导入示例 */}
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-900 mb-2">快速导入示例</h3>
              <div className="text-xs text-green-800 space-y-1">
                <p>BSC: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c</p>
                <p>ETH: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48</p>
                <p>Polygon: 0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0</p>
              </div>
              <button
                onClick={() => setAddresses('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c\n0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48\n0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0')}
                className="mt-2 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                填入示例地址
              </button>
        </div>
      </div>
    </div>
  );
}