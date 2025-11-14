import apiService from './apiService';

export async function listRpcNodes() {
  return apiService.get('/api/rpc-nodes');
}

export async function addRpcNode(body: { chain_key: string; chain_name: string; chain_id: number; node_name: string; rpc_url: string }) {
  return apiService.post('/api/rpc-nodes', body);
}

export async function updateRpcNode(id: number, body: { node_name: string; rpc_url: string; is_active: boolean }) {
  return apiService.put(`/api/rpc-nodes/${id}`, body);
}

export async function deleteRpcNode(id: number) {
  return apiService.delete(`/api/rpc-nodes/${id}`);
}

export async function pingRpcNode(id: number) {
  return apiService.post(`/api/rpc-nodes/${id}/ping`);
}

