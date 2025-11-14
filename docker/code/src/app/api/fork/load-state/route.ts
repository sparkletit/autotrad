import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { ok, fail, serverFetch } from '@/lib/serverUtils';

/**
 * POST /api/fork/load-state
 * 通过 RPC 将保存的状态加载到正在运行的 Anvil 实例
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stateName } = body;

    if (!stateName) { return fail('请提供状态名称', 400); }

    console.log(`正在加载网络状态: ${stateName}`);

    // 读取状态文件（使用挂载的共享目录）
    const statesDir = process.env.ANVIL_STATES_DIR || join(process.cwd(), 'anvil-states');
    const filePath = join(statesDir, `${stateName}.json`);
    
    let stateData: string;
    try { const fileContent = await readFile(filePath, 'utf-8'); stateData = fileContent.trim().replace(/^"|"$/g, ''); }
    catch (err: any) { if (err.code === 'ENOENT') { return fail(`状态文件不存在: ${stateName}`, 404); } throw err; }

    // 调用 Anvil 的 anvil_loadState RPC 方法
    const rpcUrl = process.env.ANVIL_RPC_URL || 'http://anvil-api:8545';
    const response = await serverFetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'anvil_loadState', params: [stateData], id: 1 }),
    }, 15000);

    const result = await response.json();

    if (result.error) {
      throw new Error(`加载状态失败: ${result.error.message}`);
    }

    console.log(`✅ 状态 "${stateName}" 已成功加载`);

    return ok({ message: `网络状态 "${stateName}" 已成功加载` });
  } catch (error) {
    console.error('加载网络状态失败:', error);
    const errorMessage = error instanceof Error ? error.message : '加载失败';
    return fail(errorMessage, 500);
  }
}
