import { NextRequest } from 'next/server';
import mysql from 'mysql2/promise';
import { ok, fail } from '@/lib/serverUtils';

const dbConfig = {
  host: 'mysql',
  port: 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'webdev123',
  database: process.env.MYSQL_DATABASE || 'web3_trad',
};

/**
 * PUT /api/address-aliases/[id]
 * 更新交易池地址
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection;
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    const body = await request.json();
    const { alias, address, network, type } = body;

    if (!alias || !address || !network || !type) { return fail('缺少必要参数', 400); }

    connection = await mysql.createConnection(dbConfig);

    // 检查地址和别名是否已被其他记录使用
    const [existing] = await connection.execute(
      'SELECT id FROM address_aliases WHERE (alias = ? OR address = ?) AND id != ? AND is_active = true',
      [alias, address, id]
    );

    if ((existing as any[]).length > 0) { await connection.end(); return fail('该别名或地址已被其他记录使用', 400); }

    // 更新别名
    const [result] = await connection.execute(
      'UPDATE address_aliases SET alias = ?, address = ?, network = ?, type = ?, updated_at = NOW() WHERE id = ?',
      [alias, address, network, type, id]
    );

    await connection.end();

    if ((result as any).affectedRows === 0) { return fail('交易池地址不存在', 404); }

    return ok({ message: '交易池地址更新成功' });
  } catch (error) {
    console.error('更新交易池地址失败:', error);
    if (connection) await connection.end();
    return fail('更新交易池地址失败', 500);
  }
}

/**
 * DELETE /api/address-aliases/[id]
 * 删除交易池地址
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection;
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    connection = await mysql.createConnection(dbConfig);

    // 软删除（更新is_active为false）
    const [result] = await connection.execute(
      'UPDATE address_aliases SET is_active = false, updated_at = NOW() WHERE id = ?',
      [id]
    );

    await connection.end();

    if ((result as any).affectedRows === 0) { return fail('交易池地址不存在', 404); }

    return ok({ message: '交易池地址删除成功' });
  } catch (error) {
    console.error('删除交易池地址失败:', error);
    if (connection) await connection.end();
    return fail('删除交易池地址失败', 500);
  }
}
