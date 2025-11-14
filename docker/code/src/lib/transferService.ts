import apiService from './apiService';

export async function transfer(body: {
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenAddress: string | null;
}) {
  return apiService.post('/api/transfer', body);
}

export async function getStatus(txHash: string) {
  return apiService.get(`/api/transfer/status?txHash=${encodeURIComponent(txHash)}`);
}

