import { NextRequest } from 'next/server';
import { ok, fail, serverFetch } from '@/lib/serverUtils';

// Anvil API 服务地址（在 Docker 网络中通过服务名访问）
const ANVIL_API_URL = process.env.ANVIL_API_URL || 'http://anvil-api:3000';

/**
 * DELETE /api/fork/stop
 * 通过 Anvil API 服务停止 Anvil Fork 网络
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log('通过 Anvil API 停止 Fork');

    // 调用 Anvil API 服务停止 Fork
    const response = await serverFetch(`${ANVIL_API_URL}/stop`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } }, 10000);

    const result = await response.json();

    if (!response.ok || !result.success) {
      return fail(result.error || '停止 Anvil Fork 失败', response.status || 500);
    }

    return ok({ message: 'Anvil Fork网络已停止' });
  } catch (error) {
    console.error('停止 Anvil Fork 失败:', error);
    return fail('停止失败', 500);
  }
}

/**
 * POST /api/fork/stop
 * 停止Anvil Fork网络（备用方法）
 */
export async function POST(request: NextRequest) { return DELETE(request); }
