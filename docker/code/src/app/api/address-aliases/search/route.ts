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
 * GET /api/address-aliases/search?q=keyword
 * 搜索地址别名，关键词匹配alias
 * 如果未提供关键词，返回前10条
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    const connection = await mysql.createConnection(dbConfig);

    let sql = 'SELECT id, alias, address FROM address_aliases WHERE is_active = 1';
    const params: any[] = [];

    // 只搜索alias字段
    if (query.trim()) {
      sql += ' AND alias LIKE ?';
      const searchTerm = `%${query}%`;
      params.push(searchTerm);
    }

    sql += ' ORDER BY alias ASC LIMIT 10';

    const [rows] = await connection.execute(sql, params);
    await connection.end();

    return ok(rows);
  } catch (error) {
    console.error('搜索地址别名失败:', error);
    return fail('搜索地址别名失败', 500);
  }
}
