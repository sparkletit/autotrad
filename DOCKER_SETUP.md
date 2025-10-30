# Docker 环境配置指南

## 项目结构

```
web3_trad/
├── docker/
│   ├── code/              # Next.js项目代码
│   ├── data/              # MySQL数据持久化
│   └── env/
│       ├── .env           # 环境变量配置（实际使用）
│       └── .env.example   # 环境变量示例
├── docker-compose.yml     # Docker Compose配置
└── ...其他配置文件
```

## 快速开始

### 1. 配置环境变量

编辑 `docker/env/.env` 文件（可选）：

```bash
# Node.js 配置
NODE_PORT=8888
NODE_ENV=development

# MySQL 配置
MYSQL_PORT=33061
MYSQL_ROOT_PASSWORD=webdev123
MYSQL_USER=webdev
MYSQL_PASSWORD=webdev123
MYSQL_DATABASE=web3_trad
```

### 2. 启动Docker容器

```bash
# 从项目根目录启动
docker-compose up -d

# 查看日志
docker-compose logs -f nodejs    # 查看Node.js日志
docker-compose logs -f mysql     # 查看MySQL日志
```

### 3. 开发工作流

- 编辑本地 `docker/code/` 中的代码
- Docker 会自动监听文件变化（hot reload）
- 访问 `http://localhost:8888` 查看应用

### 4. 停止容器

```bash
docker-compose down
```

## 数据库连接

### 从Docker容器内部连接

```javascript
// 使用容器网络 DNS
const host = 'mysql';
const port = 3306;
const user = 'root';
const password = 'webdev123';
const database = 'web3_trad';
```

### 从本地连接

```javascript
// 使用宿主机IP或localhost
const host = 'localhost';
const port = 33061;  // 暴露的端口
const user = 'root';
const password = 'webdev123';
const database = 'web3_trad';
```

## 常用命令

```bash
# 查看容器状态
docker-compose ps

# 进入Node.js容器
docker-compose exec nodejs sh

# 进入MySQL容器
docker-compose exec mysql mysql -uroot -pwebdev123

# 清理所有容器和数据
docker-compose down -v

# 重建容器
docker-compose up -d --build
```

## 注意事项

- `docker/data/` 目录存储MySQL数据，删除将丢失所有数据
- `docker/code/` 中的代码与本地代码实时同步
- 修改 `.env` 文件后需要重启容器：`docker-compose restart`
