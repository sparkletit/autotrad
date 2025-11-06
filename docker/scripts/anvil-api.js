#!/usr/bin/env node

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const { readFile, writeFile, mkdir, unlink } = require('fs/promises');
const { join } = require('path');
const { existsSync } = require('fs');

// Node.js 18+ 内置 fetch

const ANVIL_EXECUTABLE = '/root/.foundry/bin/anvil';
const ANVIL_RPC_URL = 'http://localhost:8545';
const API_PORT = 3000;
const STATES_DIR = '/app/anvil-states';

let anvilProcess = null;
let currentConfig = null;

// 确保状态目录存在
async function ensureStatesDir() {
  try {
    await mkdir(STATES_DIR, { recursive: true });
  } catch (err) {
    // 目录可能已存在，忽略错误
  }
}

// 启动 Anvil Fork 网络
async function startAnvil(config) {
  // 如果已有进程在运行，先停止
  if (anvilProcess) {
    await stopAnvil();
  }

  const { rpcUrl, blockNumber, chainId = 56, loadState } = config;

  // 构建启动命令
  const args = [
    '--fork-url', rpcUrl,
    '--fork-block-number', blockNumber.toString(),
    '--port', '8545',
    '--host', '0.0.0.0',
    '--chain-id', chainId.toString(),
    '--gas-limit', '30000000',
    '--timeout', '60000',
    '--retries', '10',
    '--fork-retry-backoff', '5000',
    '--compute-units-per-second', '1000',
  ];

  // 注意：状态加载将在 fork 启动后通过 RPC 调用完成

  // 启动 Anvil Fork 进程
  console.log(`启动 Anvil Fork: ${rpcUrl} @ block ${blockNumber}`);
  
  // 确保 PATH 包含 foundry 路径
  const env = {
    ...process.env,
    PATH: `${process.env.PATH}:/root/.foundry/bin`,
  };
  
  anvilProcess = spawn(ANVIL_EXECUTABLE, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env,
  });

  // 处理输出
  anvilProcess.stdout.on('data', (data) => {
    console.log(`[Anvil] ${data.toString().trim()}`);
  });

  anvilProcess.stderr.on('data', (data) => {
    console.error(`[Anvil Error] ${data.toString().trim()}`);
  });

  // 处理进程退出
  anvilProcess.on('exit', (code, signal) => {
    console.log(`Anvil 进程已退出: code=${code}, signal=${signal}`);
    anvilProcess = null;
    currentConfig = null;
  });

  // 等待 RPC 就绪
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('等待 Anvil 启动超时'));
    }, 30000);

    const checkInterval = setInterval(async () => {
      try {
        const response = await fetch(ANVIL_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_chainId',
            params: [],
            id: 1,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.result) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve();
          }
        }
      } catch (err) {
        // 继续等待
      }
    }, 500);
  });

  // 如果指定了加载状态，在 fork 启动后加载
  if (loadState) {
    const statePath = join(STATES_DIR, `${loadState}.json`);
    if (existsSync(statePath)) {
      try {
        console.log(`正在加载状态文件: ${loadState}`);
        const stateContent = await readFile(statePath, 'utf-8');
        // 处理 JSON 文件格式（可能是带引号的 hex 字符串或纯 JSON）
        let stateData = stateContent.trim();
        // 如果是 JSON 格式，需要提取 hex 字符串
        if (stateData.startsWith('{')) {
          const stateObj = JSON.parse(stateData);
          stateData = typeof stateObj === 'string' ? stateObj : JSON.stringify(stateObj);
        } else {
          // 去掉可能的引号
          stateData = stateData.replace(/^"|"$/g, '');
        }

        const loadResponse = await fetch(ANVIL_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'anvil_loadState',
            params: [stateData],
            id: 1,
          }),
        });

        const loadResult = await loadResponse.json();
        if (loadResult.error) {
          throw new Error(`加载状态失败: ${loadResult.error.message}`);
        }

        console.log(`✅ 状态 "${loadState}" 已成功加载`);
      } catch (err) {
        console.error('加载状态失败:', err);
        // 不抛出错误，允许 fork 网络继续运行
      }
    } else {
      console.warn(`⚠️ 状态文件不存在: ${statePath}`);
    }
  }

  currentConfig = {
    rpcUrl: rpcUrl,
    blockNumber,
    chainId,
    loadState: loadState || null,
    rpcEndpoint: ANVIL_RPC_URL,
  };

  console.log('Anvil Fork 网络已启动');
}

// 停止 Anvil
async function stopAnvil() {
  if (anvilProcess) {
    anvilProcess.kill('SIGTERM');
    
    // 等待进程退出
    await new Promise((resolve) => {
      if (anvilProcess) {
        anvilProcess.on('exit', resolve);
        setTimeout(resolve, 5000); // 超时强制退出
      } else {
        resolve();
      }
    });

    anvilProcess = null;
    currentConfig = null;
    console.log('Anvil 已停止');
  }
}

// 获取状态
async function getStatus() {
  let isRunning = false;
  let chainId = 0;
  let blockNumber = 0;

  if (anvilProcess && !anvilProcess.killed) {
    try {
      const response = await fetch(ANVIL_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          isRunning = true;
          chainId = parseInt(data.result, 16);

          // 获取区块号
          try {
            const blockResponse = await fetch(ANVIL_RPC_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_blockNumber',
                params: [],
                id: 1,
              }),
            });
            const blockData = await blockResponse.json();
            blockNumber = blockData.result ? parseInt(blockData.result, 16) : 0;
          } catch (err) {
            console.warn('获取区块号失败:', err);
          }
        }
      }
    } catch (err) {
      console.warn('检查 Anvil 状态失败:', err);
    }
  }

  return {
    isRunning,
    chainId,
    blockNumber,
    config: currentConfig,
  };
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // GET /health - 健康检查
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        status: 'ok',
        service: 'anvil-api',
      }));
      return;
    }

    // GET /status - 获取状态
    if (req.method === 'GET' && req.url === '/status') {
      const status = await getStatus();
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        ...status,
      }));
      return;
    }

    // POST /start - 启动 Fork
    if (req.method === 'POST' && req.url === '/start') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const config = JSON.parse(body);
          const { rpcUrl, blockNumber, chainId = 56, loadState } = config;

          if (!rpcUrl || blockNumber === undefined) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: '缺少必要参数: rpcUrl 或 blockNumber' }));
            return;
          }

          await startAnvil({ rpcUrl, blockNumber, chainId, loadState });

          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            message: 'Anvil Fork网络已启动',
            config: currentConfig,
          }));
        } catch (error) {
          console.error('启动 Anvil 失败:', error);
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      });
      return;
    }

    // DELETE /stop - 停止 Fork
    if (req.method === 'DELETE' && req.url === '/stop') {
      await stopAnvil();
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: 'Anvil Fork网络已停止',
      }));
      return;
    }

    // POST /stop - 停止 Fork（备用方法）
    if (req.method === 'POST' && req.url === '/stop') {
      await stopAnvil();
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: 'Anvil Fork网络已停止',
      }));
      return;
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, error: '路由不存在' }));
  } catch (error) {
    console.error('处理请求失败:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
});

// 初始化
async function init() {
  await ensureStatesDir();
  console.log('Anvil API 服务初始化完成');
}

// 启动服务器
init().then(() => {
  server.listen(API_PORT, '0.0.0.0', () => {
    console.log(`Anvil API服务运行在 http://0.0.0.0:${API_PORT}`);
  });
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到SIGTERM信号，正在关闭...');
  await stopAnvil();
  server.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('收到SIGINT信号，正在关闭...');
  await stopAnvil();
  server.close();
  process.exit(0);
});
