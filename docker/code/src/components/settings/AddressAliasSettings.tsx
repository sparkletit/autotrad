'use client';

import React, { useState, useEffect } from 'react';
import apiService from '@/lib/apiService';
import { listAliases, addAlias, updateAlias, deleteAlias } from '@/lib/addressAliasesService';

interface AddressAlias {
  id: number;
  alias: string;
  address: string;
  network: string;
  type: string;
}

const AddressAliasSettings: React.FC = () => {
  const [aliases, setAliases] = useState<AddressAlias[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newAlias, setNewAlias] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNetwork, setNewNetwork] = useState('');
  const [newType, setNewType] = useState('个人');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAlias, setEditAlias] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNetwork, setEditNetwork] = useState('');
  const [editType, setEditType] = useState('个人');

  const networks = ['Ethereum', 'Polygon', 'BSC', 'Arbitrum', 'Base'];
  const types = ['个人', '企业'];

  // 获取所有交易池地址
  useEffect(() => {
    fetchAliases();
  }, []);

  const fetchAliases = async () => {
    try {
      setLoading(true);
      const { success, data, error } = await listAliases();
      if (success) {
        setAliases((data as any) || []);
        setError('');
      } else {
        setError(error || '获取数据失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 添加新别名
  const handleAddAlias = async () => {
    if (!newAlias.trim() || !newAddress.trim() || !newNetwork) {
      setError('请填写所有字段');
      return;
    }

    try {
      setLoading(true);
      const { success, error } = await addAlias({ alias: newAlias, address: newAddress, network: newNetwork, type: newType });
      if (success) {
        setSuccess('交易池地址添加成功');
        setNewAlias('');
        setNewAddress('');
        setNewNetwork('');
        setNewType('个人');
        await fetchAliases();
      } else {
        setError(error || '添加失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setLoading(false);
    }
  };

  // 开始编辑
  const startEdit = (alias: AddressAlias) => {
    setEditingId(alias.id);
    setEditAlias(alias.alias);
    setEditAddress(alias.address);
    setEditNetwork(alias.network);
    setEditType(alias.type);
  };

  // 保存编辑
  const handleSaveEdit = async (id: number) => {
    if (!editAlias.trim() || !editAddress.trim() || !editNetwork) {
      setError('请填写所有字段');
      return;
    }

    try {
      setLoading(true);
      const { success, error } = await updateAlias(id, { alias: editAlias, address: editAddress, network: editNetwork, type: editType });
      if (success) {
        setSuccess('交易池地址更新成功');
        setEditingId(null);
        await fetchAliases();
      } else {
        setError(error || '更新失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除别名
  const handleDeleteAlias = async (id: number) => {
    if (!confirm('确定要删除这个交易池地址吗？')) {
      return;
    }

    try {
      setLoading(true);
      const { success, error } = await deleteAlias(id);
      if (success) {
        setSuccess('交易池地址删除成功');
        await fetchAliases();
      } else {
        setError(error || '删除失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 交易池地址 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-purple-600 text-lg">📍</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">交易池地址</h2>
          </div>
        </div>

        {/* 提示信息 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* 添加新地址表单 */}
        <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">添加新交易池地址</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">别名</label>
              <input
                type="text"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder="输入别名"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">地址</label>
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="输入钱包地址"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">网络</label>
              <select
                value={newNetwork}
                onChange={(e) => setNewNetwork(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700 bg-white"
              >
                <option value="">选择网络</option>
                {networks.map((net) => (
                  <option key={net} value={net}>
                    {net}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">类型</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-700 bg-white"
              >
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleAddAlias}
            disabled={loading}
            className="mt-4 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? '处理中...' : '添加地址'}
          </button>
        </div>

        {/* 地址表格 */}
        {loading && aliases.length === 0 ? (
          <p className="text-center text-gray-600 py-8">加载中...</p>
        ) : aliases.length === 0 ? (
          <p className="text-center text-gray-600 py-8">暂无交易池地址，请添加一个</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">别名</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">地址</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">网络</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">类型</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {aliases.map((alias) => (
                  <tr key={alias.id} className="border-b border-gray-200 hover:bg-gray-50">
                    {editingId === alias.id ? (
                      <>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editAlias}
                            onChange={(e) => setEditAlias(e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-gray-700"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-gray-700 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editNetwork}
                            onChange={(e) => setEditNetwork(e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-gray-700 bg-white"
                          >
                            {networks.map((net) => (
                              <option key={net} value={net}>
                                {net}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-gray-700 bg-white"
                          >
                            {types.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveEdit(alias.id)}
                              disabled={loading}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-sm transition-colors"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white rounded text-sm transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-lg font-bold">
                              📁
                            </div>
                            <span className="font-medium text-gray-900">{alias.alias}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-mono text-sm">{alias.address}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            {alias.network}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{alias.type}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEdit(alias)}
                              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => {
                                const text = `${alias.alias}: ${alias.address}`;
                                navigator.clipboard.writeText(text);
                              }}
                              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              📋
                            </button>
                            <button
                              onClick={() => handleDeleteAlias(alias.id)}
                              disabled={loading}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddressAliasSettings;
