import apiService from './apiService';

export async function listMainAccounts() {
  return apiService.get('/api/address-books/main-accounts');
}

export async function deleteMainAccount(id: number) {
  return apiService.delete(`/api/address-books/main-accounts/${id}`);
}

export async function listDerivedAccounts(mainId: number) {
  return apiService.get(`/api/address-books/main-accounts/${mainId}/derived-accounts`);
}

export async function createDerivedAccount(mainId: number, body: { accountName: string; derivationIndex: number }) {
  return apiService.post(`/api/address-books/main-accounts/${mainId}/derived-accounts`, body);
}

export async function deleteDerivedBatch(mainId: number, accountIds: number[]) {
  return apiService.post(`/api/address-books/main-accounts/${mainId}/derived-accounts/delete-batch`, { accountIds });
}

