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
 * PUT /api/rpc-nodes/[id]
 * 更新RPC节点
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    const body = await request.json();
    const { node_name, rpc_url, is_default, is_active } = body;

    const connection = await mysql.createConnection(dbConfig);

    // 检查节点是否存在
    const [nodeRows] = await connection.execute(
      'SELECT id FROM rpc_nodes WHERE id = ?',
      [id]
    );

    if ((nodeRows as any[]).length === 0) { await connection.end(); return fail('RPC节点不存在', 404); }

    // 构建更新字段
    const updates = [];
    const values = [];

    if (node_name !== undefined) {
      updates.push('node_name = ?');
      values.push(node_name);
    }
    if (rpc_url !== undefined) {
      updates.push('rpc_url = ?');
      values.push(rpc_url);
    }
    if (is_default !== undefined) {
      updates.push('is_default = ?');
      values.push(is_default);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }

    if (updates.length === 0) { await connection.end(); return fail('没有要更新的字段', 400); }

    values.push(id);
    const sql = `UPDATE rpc_nodes SET ${updates.join(', ')} WHERE id = ?`;

    await connection.execute(sql, values);
    await connection.end();

    return ok({ message: 'RPC节点更新成功' });
  } catch (error) {
    console.error('更新RPC节点失败:', error);
    return fail('更新RPC节点失败', 500);
  }
}

/**
 * DELETE /api/rpc-nodes/[id]
 * 删除RPC节点
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    const connection = await mysql.createConnection(dbConfig);

    // 检查节点是否存在
    const [nodeRows] = await connection.execute(
      'SELECT is_default FROM rpc_nodes WHERE id = ?',
      [id]
    );

    if ((nodeRows as any[]).length === 0) { await connection.end(); return fail('RPC节点不存在', 404); }

    const node = (nodeRows as any[])[0];
    if (node.is_default) { await connection.end(); return fail('无法删除默认RPC节点', 400); }

    // 删除节点
    await connection.execute('DELETE FROM rpc_nodes WHERE id = ?', [id]);
    await connection.end();

    return ok({ message: 'RPC节点删除成功' });
  } catch (error) {
    console.error('删除RPC节点失败:', error);
    return fail('删除RPC节点失败', 500);
  }
}
