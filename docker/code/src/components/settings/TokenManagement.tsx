'use client';

import React, { useState, useEffect } from 'react';

interface Token {
  id: number;
  symbol: string;
  address: string;
  decimals: number;
  is_active: boolean;
}

const TokenManagement: React.FC = () => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingToken, setEditingToken] = useState<Token | null>(null);
  const [formData, setFormData] = useState({
    symbol: '',
    address: '',
    decimals: '18',
  });

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/custom-tokens');
      const data = await response.json();
      if (data.success) {
        setTokens(data.data || []);
        setError('');
      } else {
        setError('加载代币列表失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载代币列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToken = async () => {
    if (!formData.symbol.trim()) {
      setError('请输入代币符号');
      return;
    }
    if (!formData.address.trim()) {
      setError('请输入代币地址');
      return;
    }
    if (!formData.address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('无效的代币地址格式');
      return;
    }

    const decimals = parseInt(formData.decimals);
    if (decimals < 0 || decimals > 255) {
      setError('精度必须在0-255之间');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/custom-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: formData.symbol.toUpperCase(),
          address: formData.address,
          decimals,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(`成功添加代币 ${formData.symbol}`);
        resetForm();
        setShowAddModal(false);
        await fetchTokens();
      } else {
        setError(data.error || '添加失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateToken = async () => {
    if (!editingToken) return;

    if (!formData.symbol.trim()) {
      setError('请输入代币符号');
      return;
    }

    const decimals = parseInt(formData.decimals);
    if (decimals < 0 || decimals > 255) {
      setError('精度必须在0-255之间');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/custom-tokens/${editingToken.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: formData.symbol.toUpperCase(),
          decimals,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(`成功更新代币 ${formData.symbol}`);
        resetForm();
        setEditingToken(null);
        await fetchTokens();
      } else {
        setError(data.error || '更新失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteToken = async (id: number, symbol: string) => {
    if (!confirm(`确定要删除代币 ${symbol} 吗？`)) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/custom-tokens/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(`成功删除代币 ${symbol}`);
        await fetchTokens();
      } else {
        setError(data.error || '删除失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (token: Token) => {
    setEditingToken(token);
    setFormData({
      symbol: token.symbol,
      address: token.address,
      decimals: token.decimals.toString(),
    });
  };

  const resetForm = () => {
    setFormData({
      symbol: '',
      address: '',
      decimals: '18',
    });
    setError('');
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingToken(null);
    resetForm();
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">自定义代币列表</h2>
          <p className="text-sm text-gray-600 mt-1">管理您添加的所有自定义代币</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingToken(null);
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          ➕ 添加代币
        </button>
      </div>

      {loading && tokens.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">暂无自定义代币</p>
          <button
            onClick={() => {
              resetForm();
              setEditingToken(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            添加第一个代币
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">代币符号</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">合约地址</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">精度</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">操作</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-900">{token.symbol}</span>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700 break-all">
                      {token.address}
                    </code>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{token.decimals}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleEditClick(token)}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteToken(token.id, token.symbol)}
                        className="text-red-600 hover:text-red-700 font-medium text-sm"
                        disabled={loading}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 添加/编辑模态框 */}
      {showAddModal || editingToken ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {editingToken ? '编辑代币' : '添加新代币'}
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">代币符号</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  placeholder="如：USDT"
                  disabled={loading || !!editingToken}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>

              {!editingToken && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">代币地址</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="0x..."
                    disabled={loading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">精度 (Decimals)</label>
                <input
                  type="number"
                  value={formData.decimals}
                  onChange={(e) => setFormData({ ...formData, decimals: e.target.value })}
                  min="0"
                  max="255"
                  disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={editingToken ? handleUpdateToken : handleAddToken}
                disabled={loading || !formData.symbol || (!editingToken && !formData.address)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? '处理中...' : editingToken ? '保存更改' : '确认添加'}
              </button>
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TokenManagement;
