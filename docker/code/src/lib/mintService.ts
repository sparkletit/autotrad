import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseEther,
  Hex,
} from 'viem';
import { forkManager } from './forkService';

// BNB链资产配置
const MAINNET_TOKENS = {
  BNB: {
    name: 'Binance Coin',
    symbol: 'BNB',
    decimals: 18,
    address: null, // BNB 原生资产
  },
  USDT: {
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 18,
    address: '0x55d398326f99059ff775485246999027b3197955', // BNB Chain USDT
  },
  USDC: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 18,
    address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // BNB Chain USDC
  },
  BUSD: {
    name: 'Binance USD',
    symbol: 'BUSD',
    decimals: 18,
    address: '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BNB Chain BUSD
  },
};

interface WalletBalance {
  token: string;
  balance: string;
  formatted: string;
}

/**
 * 获取Fork网络客户端
 */
function getForkClient() {
  const config = forkManager.getCurrentConfig();
  if (!config) {
    throw new Error('Fork网络未启动');
  }
  return {
    publicClient: createPublicClient({
      transport: http(config.rpcUrl),
    }),
    walletClient: createWalletClient({
      transport: http(config.rpcUrl),
    }),
    rpcUrl: config.rpcUrl,
  };
}

/**
 * 获取账户余额（BNB）
 */
export async function getBalance(address: string): Promise<string> {
  try {
    // 直接使用宜主机访问地址，不供ForkManager中的配置（因为Fork是手动启动的）
    const rpcUrl = 'http://host.docker.internal:8545';
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });
    const balance = await publicClient.getBalance({
      address: address as Hex,
    });
    return balance.toString();
  } catch (error) {
    console.error('获取余额失败:', error);
    throw error;
  }
}

/**
 * Mint BNB到指定地址（仅在Fork网络中有效）
 * 使用anvil的特殊方法通过JSON-RPC调用直接设置余额
 */
export async function mintETH(address: string, amount: string): Promise<string> {
  try {
    // 直接使用宜主机访问地址，不供ForkManager中的配置（因为Fork是手动启动的）
    const rpcUrl = 'http://host.docker.internal:8545';

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'anvil_setBalance',
        params: [address, `0x${parseEther(amount).toString(16)}`],
        id: 1,
      }),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || 'Mint失败');
    }

    console.log(`成功mint ${amount} BNB 到 ${address}`);
    return result.result;
  } catch (error) {
    console.error('Mint BNB失败:', error);
    throw error;
  }
}

/**
 * 获取支持的代币列表
 */
export function getSupportedTokens() {
  return Object.entries(MAINNET_TOKENS).map(([key, config]) => ({
    ...config,
  }));
}

/**
 * 获取账户所有余额
 */
export async function getAccountBalances(addressParam: string): Promise<WalletBalance[]> {
  try {
    const balances: WalletBalance[] = [];

    // 获取BNB余额（原生资产）
    const bnbBalance = await getBalance(addressParam);
    const bnbFormatted = (BigInt(bnbBalance) / BigInt(10 ** 18)).toString();
    balances.push({
      token: 'BNB',
      balance: bnbBalance,
      formatted: bnbFormatted,
    });

    return balances;
  } catch (error) {
    console.error('获取账户余额失败:', error);
    throw error;
  }
}
