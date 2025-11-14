import { NextRequest } from 'next/server';
import mysql from 'mysql2/promise';
import { ok, fail, serverFetch } from '@/lib/serverUtils';

const dbConfig = {
  host: process.env.MYSQL_HOST || 'mysql',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'webdev123',
  database: process.env.MYSQL_DATABASE || 'web3_trad',
};

/**
 * POST /api/rpc-nodes/[id]/ping
 * PING RPC节点并检测延迟
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    const connection = await mysql.createConnection(dbConfig);

    // 获取节点RPC URL
    const [nodeRows] = await connection.execute(
      'SELECT rpc_url FROM rpc_nodes WHERE id = ?',
      [id]
    );

    if ((nodeRows as any[]).length === 0) { await connection.end(); return fail('RPC节点不存在', 404); }

    const node = (nodeRows as any[])[0];
    const rpcUrl = node.rpc_url;

    // 发送JSON-RPC请求测试RPC连接
    const startTime = Date.now();
    let latency = 0;
    let success = false;
    let errorMsg = '';

    try {
      const response = await serverFetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
      }, 5000);

      latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        if (data.result !== undefined) {
          success = true;
        } else if (data.error) {
          errorMsg = data.error.message || 'RPC返回错误';
        }
      } else {
        errorMsg = `HTTP ${response.status}`;
      }
    } catch (error) {
      latency = Date.now() - startTime;
      errorMsg = error instanceof Error ? error.message : '请求失败';
    }

    // 更新数据库中的PING信息
    if (success) {
      await connection.execute(
        'UPDATE rpc_nodes SET last_ping_time = NOW(), last_ping_latency = ? WHERE id = ?',
        [latency, id]
      );
    }

    await connection.end();

    return ok({ success, latency, message: success ? `PING成功 (${latency}ms)` : `PING失败: ${errorMsg}` });
  } catch (error) {
    console.error('PING RPC节点失败:', error);
    return fail('PING RPC节点失败', 500);
  }
}
