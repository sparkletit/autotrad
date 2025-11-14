'use client';

import React, { useState, useEffect } from 'react';
import apiService from '@/lib/apiService';
import { listRpcNodes, addRpcNode, updateRpcNode, deleteRpcNode, pingRpcNode } from '@/lib/rpcNodesService';

interface RPCNode {
  id: number;
  chain_key: string;
  chain_name: string;
  chain_id: number;
  node_name: string;
  rpc_url: string;
  is_default: boolean;
  is_active: boolean;
  last_ping_time: string | null;
  last_ping_latency: number | null;
}

interface ChainGroup {
  chain_key: string;
  chain_name: string;
  chain_id: number;
  nodes: RPCNode[];
}

export default function RPCNodesManager() {
  const [nodes, setNodes] = useState<RPCNode[]>([]);
  const [groupedNodes, setGroupedNodes] = useState<ChainGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pingingId, setPingingId] = useState<number | null>(null);

  // 新增表单状态
  const [newNode, setNewNode] = useState({
    chain_key: 'bsc',
    chain_name: 'BSC',
    chain_id: 56,
    node_name: '',
    rpc_url: '',
  });

  // 编辑表单状态
  const [editingNode, setEditingNode] = useState<Partial<RPCNode> | null>(null);

  // 获取RPC节点列表
  const fetchNodes = async () => {
    setLoading(true);
    setError('');
    try {
      const { success, data, error } = await listRpcNodes();
      if (success) {
        setNodes((data as any) || []);
        // 按网络分组
        const grouped = groupNodesByChain((data as any) || []);
        setGroupedNodes(grouped);
      } else {
        setError(error || '获取RPC节点失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取RPC节点失败');
    } finally {
      setLoading(false);
    }
  };

  // 按网络分组
  const groupNodesByChain = (allNodes: RPCNode[]): ChainGroup[] => {
    const grouped = new Map<string, ChainGroup>();

    allNodes.forEach((node) => {
      if (!grouped.has(node.chain_key)) {
        grouped.set(node.chain_key, {
          chain_key: node.chain_key,
          chain_name: node.chain_name,
          chain_id: node.chain_id,
          nodes: [],
        });
      }
      grouped.get(node.chain_key)!.nodes.push(node);
    });

    return Array.from(grouped.values()).sort((a, b) =>
      a.chain_key.localeCompare(b.chain_key)
    );
  };

  // 添加RPC节点
  const handleAddNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNode.node_name.trim() || !newNode.rpc_url.trim()) {
      setError('节点名称和RPC URL不能为空');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { success, error } = await addRpcNode(newNode);
      if (success) {
        setShowAddForm(false);
        setNewNode({
          chain_key: 'bsc',
          chain_name: 'BSC',
          chain_id: 56,
          node_name: '',
          rpc_url: '',
        });
        await fetchNodes();
      } else {
        setError(error || '添加RPC节点失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加RPC节点失败');
    } finally {
      setLoading(false);
    }
  };

  // 编辑RPC节点
  const handleEditNode = async (id: number) => {
    if (!editingNode || !editingNode.node_name?.trim() || !editingNode.rpc_url?.trim()) {
      setError('节点名称和RPC URL不能为空');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { success, error } = await updateRpcNode(id, { node_name: editingNode.node_name!, rpc_url: editingNode.rpc_url!, is_active: !!editingNode.is_active });
      if (success) {
        setEditingId(null);
        setEditingNode(null);
        await fetchNodes();
      } else {
        setError(error || '编辑RPC节点失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '编辑RPC节点失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除RPC节点
  const handleDeleteNode = async (id: number) => {
    if (!confirm('确定要删除此RPC节点吗？')) return;

    setLoading(true);
    setError('');
    try {
      const { success, error } = await deleteRpcNode(id);
      if (success) {
        await fetchNodes();
      } else {
        setError(error || '删除RPC节点失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除RPC节点失败');
    } finally {
      setLoading(false);
    }
  };

  // PING RPC节点
  const handlePingNode = async (id: number) => {
    setPingingId(id);
    try {
      const { success, error } = await pingRpcNode(id);

      // 刷新列表以显示更新的PING结果
      await fetchNodes();

      if (!success) {
        setError(`PING 失败: ${error || ''}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PING失败');
    } finally {
      setPingingId(null);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">RPC节点管理</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          {showAddForm ? '取消' : '添加RPC节点'}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* 添加表单 */}
      {showAddForm && (
        <form onSubmit={handleAddNode} className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                网络
              </label>
              <select
                value={newNode.chain_key}
                onChange={(e) => {
                  const chainKey = e.target.value;
                  const chainInfo = getChainInfo(chainKey);
                  setNewNode({
                    ...newNode,
                    chain_key: chainKey,
                    chain_name: chainInfo.name,
                    chain_id: chainInfo.id,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getAvailableChains().map((chain) => (
                  <option key={chain.key} value={chain.key}>
                    {chain.name} (Chain ID: {chain.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                节点名称
              </label>
              <input
                type="text"
                value={newNode.node_name}
                onChange={(e) =>
                  setNewNode({ ...newNode, node_name: e.target.value })
                }
                placeholder="例如：Alchemy, Infura, 自定义..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-900 mb-1">
              RPC URL
            </label>
            <input
              type="url"
              value={newNode.rpc_url}
              onChange={(e) =>
                setNewNode({ ...newNode, rpc_url: e.target.value })
              }
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? '添加中...' : '添加'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="flex-1 py-2 px-4 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {/* RPC节点列表 */}
      {loading && <p className="text-center text-gray-600">加载中...</p>}

      {!loading && groupedNodes.length === 0 && (
        <p className="text-center text-gray-600">暂无RPC节点</p>
      )}

      {!loading &&
        groupedNodes.map((chain) => (
          <div key={chain.chain_key} className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {chain.chain_name} (Chain ID: {chain.chain_id})
            </h3>

            <div className="space-y-3">
              {chain.nodes.map((node) => (
                <div
                  key={node.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300"
                >
                  {editingId === node.id ? (
                    // 编辑模式
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingNode?.node_name || ''}
                        onChange={(e) =>
                          setEditingNode({
                            ...editingNode,
                            node_name: e.target.value,
                          })
                        }
                        placeholder="节点名称"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="url"
                        value={editingNode?.rpc_url || ''}
                        onChange={(e) =>
                          setEditingNode({
                            ...editingNode,
                            rpc_url: e.target.value,
                          })
                        }
                        placeholder="RPC URL"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditNode(node.id)}
                          disabled={loading}
                          className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {loading ? '保存中...' : '保存'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditingNode(null);
                          }}
                          className="flex-1 py-2 px-3 bg-gray-300 hover:bg-gray-400 text-gray-900 text-sm font-medium rounded-lg transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 展示模式
                    <>
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-gray-900">
                            {node.node_name}
                            {node.is_default && (
                              <span className="ml-2 px-2 py-1 text-xs font-bold bg-blue-100 text-blue-700 rounded">
                                默认
                              </span>
                            )}
                          </h4>
                          <div className="flex items-center gap-2">
                            {node.last_ping_latency !== null && (
                              <span
                                className={`text-xs font-semibold px-2 py-1 rounded ${
                                  node.last_ping_latency < 500
                                    ? 'bg-green-100 text-green-700'
                                    : node.last_ping_latency < 1000
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {node.last_ping_latency}ms
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 font-mono break-all">
                          {node.rpc_url}
                        </p>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handlePingNode(node.id)}
                          disabled={pingingId === node.id}
                          className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {pingingId === node.id ? 'PING中...' : 'PING'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(node.id);
                            setEditingNode({ ...node });
                          }}
                          className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteNode(node.id)}
                          disabled={node.is_default || loading}
                          className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                          title={node.is_default ? '无法删除默认节点' : ''}
                        >
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

// 辅助函数
function getAvailableChains() {
  return [
    { key: 'ethereum', name: 'Ethereum', id: 1 },
    { key: 'bsc', name: 'BSC', id: 56 },
    { key: 'polygon', name: 'Polygon', id: 137 },
    { key: 'arbitrum', name: 'Arbitrum', id: 42161 },
    { key: 'base', name: 'Base', id: 8453 },
  ];
}

function getChainInfo(key: string) {
  const chains = getAvailableChains();
  const chain = chains.find((c) => c.key === key);
  return chain || { name: '', id: 0 };
}
