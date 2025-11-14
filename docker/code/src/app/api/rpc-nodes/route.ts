import { NextRequest } from 'next/server';
import mysql from 'mysql2/promise';
import { ok, fail } from '@/lib/serverUtils';

const dbConfig = {
  host: process.env.MYSQL_HOST || 'mysql',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'webdev123',
  database: process.env.MYSQL_DATABASE || 'web3_trad',
};

/**
 * GET /api/rpc-nodes
 * 获取所有RPC节点列表
 */
export async function GET(request: NextRequest) {
  try {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(
      'SELECT id, chain_key, chain_name, chain_id, node_name, rpc_url, is_default, is_active, last_ping_time, last_ping_latency FROM rpc_nodes ORDER BY chain_key, is_default DESC, created_at'
    );

    await connection.end();

    return ok(rows);
  } catch (error) {
    console.error('获取RPC节点列表失败:', error);
    return fail('获取RPC节点列表失败', 500);
  }
}

/**
 * POST /api/rpc-nodes
 * 添加新的RPC节点
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chain_key, chain_name, chain_id, node_name, rpc_url } = body;

    if (!chain_key || !chain_name || chain_id === undefined || !node_name || !rpc_url) { return fail('缺少必要参数', 400); }

    const connection = await mysql.createConnection(dbConfig);

    // 检查是否已存在相同的RPC URL
    const [existingRows] = await connection.execute(
      'SELECT id FROM rpc_nodes WHERE chain_key = ? AND rpc_url = ?',
      [chain_key, rpc_url]
    );

    if ((existingRows as any[]).length > 0) { await connection.end(); return fail('该RPC URL已存在', 400); }

    // 插入新节点
    const [result] = await connection.execute(
      'INSERT INTO rpc_nodes (chain_key, chain_name, chain_id, node_name, rpc_url) VALUES (?, ?, ?, ?, ?)',
      [chain_key, chain_name, chain_id, node_name, rpc_url]
    );

    await connection.end();

    return ok({
      message: 'RPC节点添加成功',
      data: {
        id: (result as any).insertId,
        chain_key,
        chain_name,
        chain_id,
        node_name,
        rpc_url,
        is_default: false,
        is_active: true,
      },
    });
  } catch (error) {
    console.error('添加RPC节点失败:', error);
    return fail('添加RPC节点失败', 500);
  }
}
