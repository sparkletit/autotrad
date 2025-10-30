#!/bin/sh

# Anvil启动脚本 - 优化国内源加速下载

set -e

echo "========================================"
echo "Anvil Fork 网络启动脚本"
echo "========================================"

# 1. 更新Alpine镜像源为国内源（可选，加速apk下载）
echo "[1/5] 配置Alpine镜像源..."
cat > /etc/apk/repositories <<EOF
https://mirrors.aliyun.com/alpine/v3.22/main
https://mirrors.aliyun.com/alpine/v3.22/community
EOF

# 2. 安装必要的依赖
echo "[2/5] 安装依赖..."
apk add --no-cache curl bash git build-base

# 3. 下载并安装Foundry
echo "[3/5] 下载并安装Foundry..."
# 使用官方安装脚本，但添加超时和重试机制
export FOUNDRY_DIR="${HOME}/.foundry"
curl --proto '=https' --tlsv1.2 -sSf https://foundry.paradigm.xyz | bash

# 4. 初始化环境
echo "[4/5] 初始化Foundry环境..."
source "${HOME}/.bashrc"

# 5. 启动Anvil
echo "[5/5] 启动Anvil Fork 网络..."
echo "Fork RPC: ${FORK_RPC_URL}"
echo "Block Number: ${FORK_BLOCK_NUMBER}"
echo "Chain ID: ${FORK_CHAIN_ID}"
echo "Listening on: 0.0.0.0:8545"
echo "========================================"

# 启动anvil
exec ${FOUNDRY_DIR}/bin/anvil \
  --fork-url "${FORK_RPC_URL}" \
  --fork-block-number "${FORK_BLOCK_NUMBER}" \
  --port 8545 \
  --host 0.0.0.0 \
  --chain-id "${FORK_CHAIN_ID}"
