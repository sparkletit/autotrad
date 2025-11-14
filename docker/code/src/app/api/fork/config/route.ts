import { NextRequest } from 'next/server';
import { forkManager } from '@/lib/forkService';
import mysql from 'mysql2/promise';
import { ok, fail } from '@/lib/serverUtils';

const dbConfig = {
  host: process.env.MYSQL_HOST || 'mysql',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'webdev123',
  database: process.env.MYSQL_DATABASE || 'web3_trad',
};

/**
 * GET /api/fork/config
 * 获取可用网络列表和当前Fork配置
 * 从数据库的RPC节点表中按网络分组读取
 */
export async function GET(request: NextRequest) {
  try {
    const currentConfig = forkManager.getCurrentConfig();
    const isForking = forkManager.isForking();

    // 从数据库获取RPC节点列表
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT chain_key, chain_name, chain_id, node_name, rpc_url FROM rpc_nodes WHERE is_active = 1 ORDER BY chain_key, is_default DESC, created_at DESC'
    );
    await connection.end();

    // 按网络分组，构建chains数组
    const chainMap = new Map<string, any>();
    (rows as any[]).forEach((row) => {
      if (!chainMap.has(row.chain_key)) {
        chainMap.set(row.chain_key, {
          key: row.chain_key,
          name: row.chain_name,
          id: row.chain_id,
          rpcUrl: row.rpc_url, // 使用第一个（默认）RPC
          nodes: [], // 存储该网络的所有RPC节点
        });
      }
      chainMap.get(row.chain_key).nodes.push({
        nodeName: row.node_name,
        rpcUrl: row.rpc_url,
      });
    });

    const chains = Array.from(chainMap.values());

    return ok({ chains, currentConfig, isForking });
  } catch (error) {
    console.error('获取配置失败:', error);
    // 如果数据库连接失败，降级到内置配置
    const fallbackChains = forkManager.getAvailableChains().map(chain => ({
      key: chain.key,
      name: chain.name,
      id: chain.id,
      rpcUrl: chain.rpcUrl,
      nodes: [{
        nodeName: '(Default)',
        rpcUrl: chain.rpcUrl,
      }],
    }));
    const currentConfig = forkManager.getCurrentConfig();
    const isForking = forkManager.isForking();
    return ok({ chains: fallbackChains, currentConfig, isForking });
  }
}

/**
 * POST /api/fork/config
 * 启动Fork网络
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainKey, blockNumber, forkPort = 8545 } = body;

    if (!chainKey || blockNumber === undefined) { return fail('缺少必要参数: chainKey 或 blockNumber', 400); }

    const config = await forkManager.startFork(chainKey, blockNumber, forkPort);

    return ok({ message: 'Fork网络已启动', config });
  } catch (error) {
    console.error('启动Fork失败:', error);
    const errorMessage = error instanceof Error ? error.message : '启动Fork失败';
    return fail(errorMessage, 500);
  }
}

/**
 * DELETE /api/fork/config
 * 停止Fork网络
 */
export async function DELETE(request: NextRequest) {
  try {
    forkManager.stopFork();
    return ok({ message: 'Fork网络已停止' });
  } catch (error) {
    console.error('停止Fork失败:', error);
    return fail('停止Fork失败', 500);
  }
}
