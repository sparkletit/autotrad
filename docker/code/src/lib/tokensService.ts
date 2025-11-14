import apiService from './apiService';

export async function listTokens() {
  return apiService.get('/api/custom-tokens');
}

export async function addToken(body: { symbol: string; address: string; decimals: number }) {
  return apiService.post('/api/custom-tokens', body);
}

export async function updateToken(id: number, body: { symbol: string; decimals: number }) {
  return apiService.put(`/api/custom-tokens/${id}`, body);
}

export async function deleteToken(id: number) {
  return apiService.delete(`/api/custom-tokens/${id}`);
}

