#!/bin/bash
TX_HASH="0xb907c0df9ed66a989e3e3a2362184e7ee65f1fae8fd9f4e539fc0c188551162f"

echo "查询交易 gas 使用情况..."
echo "交易哈希: $TX_HASH"
echo ""

# 查询交易 receipt
RESPONSE=$(curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getTransactionReceipt\",\"params\":[\"$TX_HASH\"],\"id\":1}")

if [ -z "$RESPONSE" ]; then
  echo "❌ 无法连接到 RPC 服务器"
  exit 1
fi

# 检查是否有错误
ERROR=$(echo "$RESPONSE" | grep -o '"error":[^}]*' || echo "")
if [ -n "$ERROR" ]; then
  echo "❌ RPC 错误: $ERROR"
  echo "完整响应: $RESPONSE"
  exit 1
fi

# 提取 gas 信息（使用 Python 或简单的字符串处理）
GAS_USED=$(echo "$RESPONSE" | grep -o '"gasUsed":"[^"]*"' | cut -d'"' -f4)
GAS_PRICE=$(echo "$RESPONSE" | grep -o '"gasPrice":"[^"]*"' | cut -d'"' -f4)

if [ -z "$GAS_USED" ]; then
  echo "❌ 交易可能还未确认或不存在"
  echo "完整响应: $RESPONSE"
  exit 1
fi

# 转换为十进制
GAS_USED_DEC=$(printf "%d" 0x${GAS_USED:2} 2>/dev/null || echo "$GAS_USED")
GAS_PRICE_DEC=$(printf "%d" 0x${GAS_PRICE:2} 2>/dev/null || echo "$GAS_PRICE")

echo "✅ Gas 使用情况:"
echo "  - Gas Used (已使用): $GAS_USED_DEC"
echo "  - Gas Price (单价): $GAS_PRICE_DEC"
echo ""
echo "完整 Receipt:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

