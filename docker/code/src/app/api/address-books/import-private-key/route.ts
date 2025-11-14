import { NextRequest } from 'next/server';
import { Wallet } from 'ethers';
import pool from '@/lib/db';
import { ok, fail } from '@/lib/serverUtils';

/**
 * POST /api/address-books/import-private-key
 * 通过私钥导入钱包到主账号
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { privateKey, accountName } = body;

    if (!privateKey || !accountName) { return fail('私钥和账号名称不能为空', 400); }

    // 验证和恢复钱包
    let wallet: Wallet;
    try { wallet = new Wallet(privateKey); } catch (err) { return fail('无效的私钥格式', 400); }

    const address = wallet.address;

    // 检查地址是否已存在
    const connection = await pool.getConnection();
    try {
      const [existingRows]: any = await connection.execute(
        'SELECT id FROM main_accounts WHERE address = ?',
        [address]
      );

      if (existingRows && existingRows.length > 0) { return fail('该钱包地址已经被导入', 400); }

      // 插入主账号
      const [result]: any = await connection.execute(
        'INSERT INTO main_accounts (account_name, address, public_key, private_key, mnemonic) VALUES (?, ?, ?, ?, ?)',
        [accountName, address, address, privateKey, null]
      );

      return ok({ id: result.insertId, address, accountName });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('导入私钥失败:', error);
    return fail('导入私钥失败', 500);
  }
}
