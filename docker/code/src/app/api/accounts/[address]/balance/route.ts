import { NextRequest } from 'next/server';
import { createPublicClient, http } from 'viem';
import type { Address } from 'viem';
import { formatBalance, normalizeAddress } from '@/lib/utils';
import { getRpcUrl, ok, fail, serverFetch, parseBlockchainError } from '@/lib/serverUtils';

/**
 * GET /api/accounts/[address]/balance
 * 获取指定账户在当前网络的余额
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return fail('无效的以太坊地址', 400);
    }
    let checksumAddress: Address;
    try {
      checksumAddress = normalizeAddress(address);
    } catch (e) {
      return fail('无效的以太坊地址', 400);
    }

    const { searchParams } = new URL(request.url);
    const tokensParam = searchParams.get('tokens');
    const requestedTokens = tokensParam
      ? tokensParam.split(',').map((t) => t.trim().toUpperCase())
      : ['BNB'];

    const rpcUrl = getRpcUrl('fork');
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });

    const balances: any[] = [];

    if (requestedTokens.includes('BNB')) {
      try {
        const bnbBalance = await publicClient.getBalance({ address: checksumAddress });
        const bnbFormatted = formatBalance(bnbBalance, 18);
        balances.push({
          symbol: 'BNB',
          name: 'Binance Coin',
          balance: bnbBalance.toString(),
          formatted: bnbFormatted,
          decimals: 18,
          contractAddress: null,
        });
      } catch (err) {}
    }

    let erc20Tokens: { symbol: string; name: string; address: string; decimals: number }[] = [];
    try {
      const resp = await serverFetch('http://localhost:8888/api/custom-tokens', { method: 'GET' }, 5000);
      const json = await resp.json();
      if (json?.success && Array.isArray(json.data)) {
        erc20Tokens = json.data.map((t: any) => ({
          symbol: String(t.symbol).toUpperCase(),
          name: String(t.symbol).toUpperCase(),
          address: String(t.address),
          decimals: parseInt(String(t.decimals)) || 18,
        }));
      }
    } catch (e) {
      erc20Tokens = [
        { symbol: 'USDT', name: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
        { symbol: 'USDC', name: 'USDC', address: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d', decimals: 18 },
        { symbol: 'BUSD', name: 'BUSD', address: '0xe9e7cea3dedca5984780bafc599bd69add087d56', decimals: 18 },
      ];
    }

    for (const token of erc20Tokens) {
      if (!requestedTokens.includes(token.symbol)) continue;
      try {
        let tokenAddr: Address;
        try {
          tokenAddr = normalizeAddress(token.address);
        } catch (e) {
          continue;
        }
        const balance = await publicClient.readContract({
          address: tokenAddr,
          abi: [
            {
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }],
            },
          ],
          functionName: 'balanceOf',
          args: [checksumAddress],
        });
        const tokenBalance = balance as bigint;
        const formatted = formatBalance(tokenBalance, token.decimals);
        balances.push({
          symbol: token.symbol,
          name: token.name,
          balance: tokenBalance.toString(),
          formatted,
          decimals: token.decimals,
          contractAddress: tokenAddr,
        });
      } catch (err) {}
    }

    return ok(balances);
  } catch (error) {
    return fail(parseBlockchainError(error), 500);
  }
}
