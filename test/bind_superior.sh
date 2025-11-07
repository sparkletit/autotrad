#!/bin/bash

# 绑定上下级关系脚本
# 流程：
# 1. A向B发送代币（建立A到B的转账意图）
# 2. B向A发送代币（建立B到A的转账意图）
# 3. A向B发送1个完整代币（10^18个最小单位）完成绑定

CONTRACT_ADDRESS="0x0193ED902BB984725c7AB939719FAD465a22C5A0"
RPC_URL="http://localhost:8545"

# 发送者A的私钥（需要有代币余额）
SENDER_A_PRIVATE_KEY="0x6f9a6acbdbcf3d7ecd558014c3b7f05f51304489658083974427d4c4ba5f7516"
SENDER_A_ADDRESS="0x73a56a2e0678bd275fC841191EDfF2f6A724F2b2"

# 上级B的地址（需要是已经存在的地址）
SUPERIOR_B_ADDRESS="0xf668ad3ce583d451e2f702ad6d67625806eb8c05"

echo "=========================================="
echo "绑定上下级关系"
echo "=========================================="
echo "发送者A地址: $SENDER_A_ADDRESS"
echo "上级B地址: $SUPERIOR_B_ADDRESS"
echo "合约地址: $CONTRACT_ADDRESS"
echo "RPC URL: $RPC_URL"
echo "=========================================="
echo ""

# 获取函数签名
echo "获取函数签名..."
TRANSFER_SIG=$(cast sig "transfer(address,uint256)")
echo "transfer 函数签名: $TRANSFER_SIG"
echo ""

BALANCEOF_SIG=$(cast sig "balanceOf(address)")
echo "balanceOf 函数签名: $BALANCEOF_SIG"
echo ""

SUPERIOR_SIG=$(cast sig "superior(address)")
echo "superior 函数签名: $SUPERIOR_SIG"
echo ""

# 检查A的代币余额
echo "1. 检查发送者A的代币余额"
echo "--------------------------"
BALANCE_A=$(cast call $CONTRACT_ADDRESS $BALANCEOF_SIG $SENDER_A_ADDRESS --rpc-url $RPC_URL)
echo "A的代币余额: $BALANCE_A"
echo ""

# 检查B的代币余额
echo "2. 检查上级B的代币余额"
echo "----------------------"
BALANCE_B=$(cast call $CONTRACT_ADDRESS $BALANCEOF_SIG $SUPERIOR_B_ADDRESS --rpc-url $RPC_URL)
echo "B的代币余额: $BALANCE_B"
echo ""

# 步骤1: A向B发送少量代币建立转账意图
echo "3. A向B发送少量代币建立转账意图"
echo "--------------------------------"
echo "正在发送 1000 个代币 (1000 * 10^18)..."
TX1_HASH=$(cast send $CONTRACT_ADDRESS $TRANSFER_SIG $SUPERIOR_B_ADDRESS 1000000000000000000000 --private-key $SENDER_A_PRIVATE_KEY --rpc-url $RPC_URL 2>&1)

if echo "$TX1_HASH" | grep -q "Error"; then
    echo "发送失败: $TX1_HASH"
    exit 1
else
    echo "交易哈希: $TX1_HASH"
    echo "等待交易确认..."
    sleep 5
fi
echo ""