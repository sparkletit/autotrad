import { spawn, ChildProcess } from 'child_process';
import pool from './db';

interface ForkConfig {
  networkId: number;
  blockNumber: number;
  rpcUrl: string;
  forkPort: number;
}

interface NetworkChain {
  name: string;
  id: number;
  rpcUrl: string;
}

// 支持的网络配置
let SUPPORTED_CHAINS: Record<string, NetworkChain> = {
  ethereum: {
    name: 'Ethereum',
    id: 1,
    rpcUrl: 'https://eth.drpc.org', // 公开RPC端点
  },
  bsc: {
    name: 'BSC',
    id: 56,
    rpcUrl: 'https://rpc.ankr.com/bsc/82c596812c311f4cc184598a378663a680bb171972733faef7b8ab81fc9cc626', // 自定义BSC RPC
  },
  polygon: {
    name: 'Polygon',
    id: 137,
    rpcUrl: 'https://polygon-rpc.com/',
  },
  arbitrum: {
    name: 'Arbitrum',
    id: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
  },
};

class ForkManager {
  private forkProcess: ChildProcess | null = null;
  private currentConfig: ForkConfig | null = null;
  private customRpcUrls: Record<string, string> = {};

  /**
   * 获取支持的网络列表
   */
  getAvailableChains() {
    return Object.entries(SUPPORTED_CHAINS).map(([key, chain]) => ({
      key,
      ...chain,
      rpcUrl: this.customRpcUrls[key] || chain.rpcUrl, // 优先使用自定义RPC
    }));
  }

  /**
   * 获取网络RPC信息
   */
  getChainConfig(chainKey: string): NetworkChain | null {
    const chain = SUPPORTED_CHAINS[chainKey];
    if (!chain) return null;
    return {
      ...chain,
      rpcUrl: this.customRpcUrls[chainKey] || chain.rpcUrl,
    };
  }

  /**
   * 设置自定义RPC URL
   */
  setCustomRpcUrl(chainKey: string, rpcUrl: string): void {
    if (SUPPORTED_CHAINS[chainKey]) {
      this.customRpcUrls[chainKey] = rpcUrl;
      console.log(`已设置${chainKey}的自定义RPC: ${rpcUrl}`);
    } else {
      throw new Error(`不支持的网络: ${chainKey}`);
    }
  }

  /**
   * 获取自定义RPC URL
   */
  getCustomRpcUrl(chainKey: string): string | null {
    return this.customRpcUrls[chainKey] || null;
  }

  /**
   * 获取所有自定义RPC配置
   */
  getAllCustomRpcUrls(): Record<string, string> {
    return { ...this.customRpcUrls };
  }

  /**
   * 启动Anvil Fork进程
   */
  async startFork(chainKey: string, blockNumber: number, forkPort: number = 8545): Promise<ForkConfig> {
    try {
      const chainConfig = this.getChainConfig(chainKey);
      if (!chainConfig) {
        throw new Error(`不支持的网络: ${chainKey}`);
      }

      console.log(`启动Fork网络: ${chainConfig.name}, 区块号: ${blockNumber}, 端口: ${forkPort}`);

      // 注意：现在通过 anvil-api 服务管理 Fork，使用服务名访问
      const rpcUrl = process.env.ANVIL_RPC_URL || `http://anvil-api:${forkPort}`;

      this.currentConfig = {
        networkId: chainConfig.id,
        blockNumber,
        rpcUrl: rpcUrl,
        forkPort,
      };

      console.log(`Fork网络配置已保存: ${rpcUrl}`);
      
      return this.currentConfig;
    } catch (error) {
      console.error('启动Fork失败:', error);
      throw error;
    }
  }

  /**
   * 检查RPC端点是否可用
   */
  private async checkRpcAvailability(rpcUrl: string): Promise<boolean> {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });
      return response.ok;
    } catch (error) {
      console.error(`RPC ${rpcUrl} 不可用:`, error);
      return false;
    }
  }

  /**
   * 停止Anvil Fork进程
   */
  stopFork(): void {
    if (this.forkProcess) {
      console.log('停止Fork网络');
      this.forkProcess.kill();
      this.forkProcess = null;
      this.currentConfig = null;
    }
  }

  /**
   * 获取当前Fork配置
   */
  getCurrentConfig(): ForkConfig | null {
    return this.currentConfig;
  }

  /**
   * 检查Fork是否正在运行
   */
  isForking(): boolean {
    // 如果有保存的配置，且对应的RPC端口可以响应，则认为Fork正在运行
    return this.currentConfig !== null;
  }
}

// 导出单例
export const forkManager = new ForkManager();
