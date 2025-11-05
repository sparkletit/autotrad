// 测试 Docker 容器到 Anvil 的连接
const http = require('http');

const testConnection = () => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    });

    const options = {
      hostname: 'host.docker.internal',
      port: 8545,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      },
      timeout: 5000
    };

    console.log('正在测试连接到 Anvil...');
    console.log('目标:', `http://${options.hostname}:${options.port}`);

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        console.log('✅ 连接成功!');
        console.log('响应状态:', res.statusCode);
        console.log('响应数据:', body);
        resolve(body);
      });
    });

    req.on('error', (error) => {
      console.error('❌ 连接失败:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      console.error('❌ 连接超时');
      req.destroy();
      reject(new Error('Connection timeout'));
    });

    req.write(data);
    req.end();
  });
};

testConnection()
  .then(() => {
    console.log('\n测试完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n测试失败:', error.message);
    process.exit(1);
  });

