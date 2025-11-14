import apiService from './apiService';

export async function listAliases() {
  return apiService.get('/api/address-aliases');
}

export async function addAlias(body: { alias: string; address: string; network: string; type: string }) {
  return apiService.post('/api/address-aliases', body);
}

export async function updateAlias(id: number, body: { alias: string; address: string; network: string; type: string }) {
  return apiService.put(`/api/address-aliases/${id}`, body);
}

export async function deleteAlias(id: number) {
  return apiService.delete(`/api/address-aliases/${id}`);
}

export async function searchAliases() {
  return apiService.get('/api/address-aliases/search');
}

