import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/serverUtils';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const searchParams = request.nextUrl.searchParams;
  const chainId = searchParams.get('chainId') || '1'; // 默认以太坊主网
  try {
    const { address } = await params;
    if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      return fail('无效的以太坊地址', 400);
    }

    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) return fail('未配置ETHERSCAN_API_KEY', 500);

    const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getabi&address=${address.toLowerCase()}&apikey=${apiKey}`;

    const proxyOpen = process.env.PROXY_OPEN === 'true';
    const proxyUrl  = process.env.PROXY;

    const fetchOptions: RequestInit = {
      method: 'GET',
      signal: AbortSignal.timeout(20000),
    };

    // 仅当开关打开且地址非空才挂代理
    if (proxyOpen && proxyUrl) {
      (fetchOptions as any).agent = new HttpsProxyAgent(proxyUrl);
    }

    const res = await fetch(url, fetchOptions);
    if (!res.ok) return fail(`Etherscan 请求失败: HTTP ${res.status}`, res.status);

    const json = await res.json();
    if (!json || json.status !== '1' || !json.result) {
      const msg = json?.result || json?.message || '获取ABI失败';
      return fail(msg, 400);
    }

    return ok({ abi: String(json.result) });
  } catch (err: any) {
    console.error('[ABI] 异常:', err);
    return fail(err.message || '内部错误', 500);
  }
}