#!/bin/bash

# 使用稳定的官方 BSC RPC 启动 Anvil
# WSS 比 HTTP 更稳定，推荐用于生产环境

set -e

ANVIL_PATH="${HOME}/.foundry/bin/anvil"
FORK_RPC="${1:-wss://bsc-ws-node.nariox.org:443}"  # 默认使用 WSS
FORK_BLOCK="${2:-67035281}"
PORT="${3:-8545}"
CHAIN_ID="${4:-56}"

echo "=========================================="
echo "启动 Anvil Fork 网络 (稳定版本)"
echo "=========================================="
echo "RPC 地址: $FORK_RPC"
echo "区块号: $FORK_BLOCK"
echo "端口: $PORT"
echo "Chain ID: $CHAIN_ID"
echo "=========================================="

# 停止已有的 anvil 进程
if pgrep -f "anvil --fork-url" > /dev/null; then
  echo "停止现有 Anvil 实例..."
  pkill -f "anvil --fork-url" || true
  sleep 2
fi

# 启动 Anvil
exec $ANVIL_PATH \
  --fork-url "$FORK_RPC" \
  --fork-block-number "$FORK_BLOCK" \
  --port "$PORT" \
  --host 0.0.0.0 \
  --chain-id "$CHAIN_ID"
