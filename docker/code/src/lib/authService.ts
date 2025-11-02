import { apiService } from './apiService';

/**
 * 认证/钱包服务层
 * 统一私钥验证和导入逻辑
 */

interface ImportWalletParams {
  privateKey: string;
  accountName: string;
}

interface ImportWalletResponse {
  id: number;
  address: string;
  accountName: string;
}

interface ValidatePrivateKeyResponse {
  address: string;
  isValid: boolean;
}

class AuthService {
  /**
   * 导入钱包（通过私钥）
   */
  async importWallet(params: ImportWalletParams) {
    return apiService.post<ImportWalletResponse>(
      '/api/address-books/import-private-key',
      params
    );
  }

  /**
   * 验证私钥格式
   * 这里只做本地验证，实际验证在导入时服务器端进行
   */
  validatePrivateKeyFormat(privateKey: string): { isValid: boolean; error?: string } {
    if (!privateKey.trim()) {
      return { isValid: false, error: '私钥不能为空' };
    }

    if (!privateKey.startsWith('0x') && privateKey.length !== 66) {
      return { isValid: false, error: '私钥必须以0x开头，且长度为66字符' };
    }

    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
      return { isValid: false, error: '私钥必须为有效的十六进制字符' };
    }

    return { isValid: true };
  }

  /**
   * 验证账户名称
   */
  validateAccountName(name: string): { isValid: boolean; error?: string } {
    if (!name.trim()) {
      return { isValid: false, error: '账户名称不能为空' };
    }

    if (name.length < 2) {
      return { isValid: false, error: '账户名称至少2个字符' };
    }

    if (name.length > 50) {
      return { isValid: false, error: '账户名称不超过50个字符' };
    }

    return { isValid: true };
  }
}

export const authService = new AuthService();

export default authService;
