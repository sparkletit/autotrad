#!/usr/bin/env node

const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const ANVIL_EXECUTABLE = '/home/xiao/.foundry/bin/anvil';
const HOST_RPC_URL = 'http://host.docker.internal:8545';
const PORT = 3000;

let currentConfig = null;

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // 启用CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/status') {
    // 获取Fork状态
    const status = {
      success: true,
      isRunning: currentConfig !== null,
      config: currentConfig,
    };
    res.writeHead(200);
    res.end(JSON.stringify(status));
  } else if (req.method === 'POST' && req.url === '/start') {
    // 启动Fork
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { rpcUrl, blockNumber, chainId = 56 } = JSON.parse(body);

        if (!rpcUrl || blockNumber === undefined) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: '缺少必要参数' }));
          return;
        }

        console.log(`启动Anvil: Block=${blockNumber}, Chain=${chainId}`);

        // 先杀死旧进程
        execAsync('pkill -f "anvil --fork-url" 2>/dev/null || true')
          .then(() => {
            // 启动新的anvil进程（在宿主机）
            const command = `nohup ${ANVIL_EXECUTABLE} --fork-url "${rpcUrl}" --fork-block-number ${blockNumber} --port 8545 --host 0.0.0.0 --chain-id ${chainId} > /tmp/anvil.log 2>&1 &`;
            console.log('执行命令:', command);
            return execAsync(command);
          })
          .then(() => {
            currentConfig = {
              rpcUrl: HOST_RPC_URL,
              blockNumber,
              chainId,
              forkPort: 8545,
            };

            console.log('Anvil启动命令已执行');
            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              message: 'Anvil Fork网络已启动',
              config: currentConfig,
            }));
          })
          .catch((error) => {
            console.error('启动Anvil失败:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, error: error.message }));
          });
      } catch (error) {
        console.error('解析请求失败:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
  } else if (req.method === 'DELETE' && req.url === '/stop') {
    // 停止Fork
    execAsync('pkill -f "anvil --fork-url" 2>/dev/null || true')
      .then(() => {
        currentConfig = null;
        console.log('Anvil已停止');
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: 'Anvil Fork网络已停止',
        }));
      })
      .catch((error) => {
        console.error('停止Anvil失败:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: error.message }));
      });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, error: '路由不存在' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Anvil API服务运行在 http://0.0.0.0:${PORT}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭...');
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭...');
  server.close();
  process.exit(0);
});
