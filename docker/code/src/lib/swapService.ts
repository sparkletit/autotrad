import apiService from './apiService';

export async function queryReserves(body: { pairAddress: string; network: string; account?: string }) {
  return apiService.post('/api/swap/get-reserves', body);
}

export async function getPair(body: { tokenA: string; tokenB: string; network: string }) {
  return apiService.post('/api/swap/get-pair', body);
}

export async function wrapWBNB(body: { account: string; amount: string; network: string }) {
  return apiService.post('/api/swap/wrap-wbnb', body);
}

export async function addLiquidity(body: {
  account: string;
  toAddress?: string;
  tokenA: string;
  tokenB: string;
  amountADesired: string;
  amountBDesired: string;
  amountAMin?: string;
  amountBMin?: string;
  slippage: 'auto' | '0.5' | '5' | '10';
  network: string;
}) {
  return apiService.post('/api/swap/add-liquidity', body);
}

export async function removeLiquidity(body: {
  account: string;
  toAddress?: string;
  pairAddress: string;
  liquidity: string;
  amountAMin?: string;
  amountBMin?: string;
  slippage: 'auto' | '0.5' | '5' | '10';
  network: string;
}) {
  return apiService.post('/api/swap/remove-liquidity', body);
}

export async function executeSwap(body: {
  account: string;
  toAddress: string;
  pairAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  gasLimit: string | 'auto';
  slippage: string | 'auto';
  network: string;
}) {
  return apiService.post('/api/swap/execute', body);
}

