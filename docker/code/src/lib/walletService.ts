import { Wallet, HDNodeWallet } from 'ethers';
import { generateMnemonic, mnemonicToSeed } from 'bip39';
import pool from './db';

/**
 * 生成新的主账号
 * @param accountName - 账号名称
 * @returns 主账号信息
 */
export async function generateMainAccount(accountName: string) {
  try {
    // 生成助记词
    const mnemonic = generateMnemonic(128); // 12个单词的助记词

    // 通过助记词创建钱包
    const wallet = Wallet.fromPhrase(mnemonic);

    const address = wallet.address;
    const privateKey = wallet.privateKey;

    const connection = await pool.getConnection();
    try {
      // 插入数据库
      const [result]: any = await connection.execute(
        'INSERT INTO main_accounts (account_name, address, public_key, mnemonic, private_key) VALUES (?, ?, ?, ?, ?)',
        [accountName, address, address, mnemonic, privateKey]
      );

      return {
        id: result.insertId,
        address,
        mnemonic,
        privateKey,
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('生成主账号失败:', error);
    throw error;
  }
}

/**
 * 通过主账号生成派生子账号
 * @param mainAccountId - 主账号ID
 * @param derivationIndex - 派生索引
 * @param accountName - 子账号名称
 * @returns 派生账号信息
 */
export async function generateDerivedAccount(
  mainAccountId: number,
  derivationIndex: number,
  accountName: string
) {
  try {
    const connection = await pool.getConnection();
    try {
      // 从数据库获取主账号信息
      const [rows]: any = await connection.execute(
        'SELECT * FROM main_accounts WHERE id = ?',
        [mainAccountId]
      );

      if (!rows || rows.length === 0) {
        throw new Error('主账号不存在');
      }

      const mainAccount = rows[0];

      // 通过主账号的助记词派生子账号
      // BIP44伙记词路径：m/44'/coin_type'/account'/change/address_index
      // ETH: m/44'/60'/0'/0/address_index
      const wallet = HDNodeWallet.fromPhrase(
        mainAccount.mnemonic,
        undefined,
        `m/44'/60'/0'/0/${derivationIndex}`
      );

      const address = wallet.address;
      const privateKey = wallet.privateKey;
      const derivationPath = `m/44'/60'/0'/0/${derivationIndex}`;

      // 插入派生账号
      const [result]: any = await connection.execute(
        'INSERT INTO derived_accounts (main_account_id, account_name, address, public_key, private_key, derivation_path, index_num) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [mainAccountId, accountName, address, address, privateKey, derivationPath, derivationIndex]
      );

      return {
        id: result.insertId,
        address,
        derivationPath,
        privateKey,
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('生成派生账号失败:', error);
    throw error;
  }
}

/**
 * 获取主账号列表
 * @returns 主账号列表
 */
export async function getMainAccounts() {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows]: any = await connection.execute(
        'SELECT id, account_name, address, mnemonic, private_key, created_at FROM main_accounts ORDER BY created_at DESC'
      );

      return rows;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('获取主账号列表失败:', error);
    throw error;
  }
}

/**
 * 获取派生账号列表
 * @param mainAccountId - 主账号ID
 * @returns 派生账号列表
 */
export async function getDerivedAccounts(mainAccountId: number) {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows]: any = await connection.execute(
        'SELECT id, account_name, address, private_key, derivation_path, index_num, created_at FROM derived_accounts WHERE main_account_id = ? ORDER BY index_num',
        [mainAccountId]
      );

      return rows;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('获取派生账号列表失败:', error);
    throw error;
  }
}

/**
 * 获取主账号的详细信息
 * @param mainAccountId - 主账号ID
 * @returns 主账号详细信息
 */
export async function getMainAccountById(mainAccountId: number) {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows]: any = await connection.execute(
        'SELECT * FROM main_accounts WHERE id = ?',
        [mainAccountId]
      );

      return rows[0] || null;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('获取主账号详情失败:', error);
    throw error;
  }
}
