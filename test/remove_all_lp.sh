#!/bin/bash

# 移除主账号所有LP脚本
# 该脚本将查询主账号的LP余额，并通过 PancakeSwap V2 Router 移除所有流动性

# 配置参数
PAIR_ADDRESS="0xc3311152e8c75fe80db5debf2008dd3f4fc2e121"  # LP交易池地址
CONTRACT_ADDRESS="0x0193ED902BB984725c7AB939719FAD465a22C5A0"  # 主合约地址

# 设置默认 RPC_URL
RPC_URL=${RPC_URL:-"http://localhost:8545"}
FUNDER_PRIVATE_KEY=${FUNDER_PRIVATE_KEY:-"0x6f9a6acbdbcf3d7ecd558014c3b7f05f51304489658083974427d4c4ba5f7516"}

# 检查 PRIVATE_KEY 是否设置
if [ -z "$FUNDER_PRIVATE_KEY" ]; then
    echo "警告: FUNDER_PRIVATE_KEY 未设置，将只显示命令"
    DRY_RUN=true
else
    DRY_RUN=false
fi

# 辅助函数：提取交易哈希并格式化输出
format_tx_output() {
    local tx_output=$1
    
    if echo "$tx_output" | grep -qi "error\|revert\|failed"; then
        echo "✗ 错误"
        return 1
    else
        # 提取交易哈希（尝试多种格式）
        TX_HASH=$(echo "$tx_output" | grep -oE "0x[0-9a-f]{64}" | head -1)
        
        # 如果没找到，尝试从 JSON 格式中提取
        if [ -z "$TX_HASH" ]; then
            TX_HASH=$(echo "$tx_output" | grep -iE "transactionHash|txHash" | head -1 | grep -oE "0x[0-9a-f]{64}" | head -1)
        fi
        
        if [ ! -z "$TX_HASH" ]; then
            echo "✓ ---$TX_HASH"
            return 0
        else
            echo "✓"
            return 0
        fi
    fi
}

# 辅助函数：解析LP余额（处理科学计数法格式）
parse_lp_balance() {
    local balance_raw=$1
    # 提取数字部分（去除科学计数法表示，如 [1.47e24]）
    # 处理格式：1470729722317416730187496[1.47e24] 或 1470729722317416730187496
    echo "$balance_raw" | sed 's/\[.*\]//' | awk '{print $1}' | grep -oE '^[0-9]+' | head -1
}

echo "=========================================="
echo "移除主账号所有LP脚本"
echo "=========================================="
echo "RPC URL: $RPC_URL"
echo "合约地址: $CONTRACT_ADDRESS"
echo "Pair 地址: $PAIR_ADDRESS"
echo "=========================================="
echo ""

# 步骤1: 获取资金提供者地址
echo "步骤1: 获取资金提供者地址..."
FUNDER_ADDRESS=$(cast wallet address --private-key $FUNDER_PRIVATE_KEY 2>/dev/null)
if [ -z "$FUNDER_ADDRESS" ]; then
    echo "错误: 无法从私钥获取地址"
    exit 1
fi
echo "资金提供者地址: $FUNDER_ADDRESS"

# 检查资金提供者余额
FUNDER_BALANCE=$(cast balance $FUNDER_ADDRESS --rpc-url $RPC_URL 2>/dev/null)
if [ -z "$FUNDER_BALANCE" ]; then
    echo "警告: 无法获取资金提供者余额"
else
    FUNDER_BALANCE_ETH=$(cast --to-unit $FUNDER_BALANCE ether 2>/dev/null || echo "N/A")
    echo "资金提供者余额: $FUNDER_BALANCE_ETH BNB"
fi
echo ""

# 步骤2: 获取 Pair 合约的 token0 和 token1 地址
echo "步骤2: 获取 Pair 合约信息..."
TOKEN0_ADDRESS=$(cast call $PAIR_ADDRESS "token0()(address)" --rpc-url $RPC_URL 2>/dev/null | tr -d '[:space:]')
TOKEN1_ADDRESS=$(cast call $PAIR_ADDRESS "token1()(address)" --rpc-url $RPC_URL 2>/dev/null | tr -d '[:space:]')

if [ -z "$TOKEN0_ADDRESS" ] || [ -z "$TOKEN1_ADDRESS" ]; then
    echo "错误: 无法获取 token 地址"
    exit 1
fi

echo "Token0 地址: $TOKEN0_ADDRESS"
echo "Token1 地址: $TOKEN1_ADDRESS"
echo ""

# 步骤3: 获取 Router 地址
echo "步骤3: 获取 Router 地址..."
ROUTER_ADDRESS=$(cast call $CONTRACT_ADDRESS "router()(address)" --rpc-url $RPC_URL 2>/dev/null | tr -d '[:space:]')
if [ -z "$ROUTER_ADDRESS" ]; then
    echo "错误: 无法获取 Router 地址"
    exit 1
fi
echo "Router 地址: $ROUTER_ADDRESS"
echo ""

# 步骤4: 查询主账号的LP余额
echo "步骤4: 查询主账号的LP余额..."
FUNDER_LP_BALANCE_RAW=$(cast call $PAIR_ADDRESS "balanceOf(address)(uint256)" $FUNDER_ADDRESS --rpc-url $RPC_URL 2>/dev/null)
FUNDER_LP_BALANCE=$(parse_lp_balance "$FUNDER_LP_BALANCE_RAW")

if [ -z "$FUNDER_LP_BALANCE" ] || [ "$FUNDER_LP_BALANCE" = "0" ]; then
    echo "警告: 主账号LP余额为0，无法移除流动性"
    exit 0
fi

FUNDER_LP_BALANCE_ETH=$(cast --to-unit $FUNDER_LP_BALANCE ether 2>/dev/null || echo "N/A")
echo "主账号LP余额: $FUNDER_LP_BALANCE ($FUNDER_LP_BALANCE_ETH)"
echo ""

# 步骤5: 授权 Router 使用 LP
echo "步骤5: 授权 Router 使用 LP..."
APPROVE_CMD="cast send $PAIR_ADDRESS \"approve(address,uint256)\" $ROUTER_ADDRESS $FUNDER_LP_BALANCE --rpc-url $RPC_URL --private-key $FUNDER_PRIVATE_KEY"

if [ "$DRY_RUN" = false ]; then
    TX_OUTPUT=$(eval $APPROVE_CMD 2>&1)
    format_tx_output "$TX_OUTPUT"
    sleep 0.1
else
    echo "命令: $APPROVE_CMD"
fi
echo ""

# 步骤6: 获取当前储备量以计算最小输出
echo "步骤6: 获取当前储备量..."
RESERVES=$(cast call $PAIR_ADDRESS "getReserves()(uint112,uint112,uint32)" --rpc-url $RPC_URL 2>/dev/null)
if [ ! -z "$RESERVES" ]; then
    # 解析储备量
    RESERVE_DATA=$(python3 <<PYEOF
import sys
lines = '''$RESERVES'''.strip().split('\n')
def parse_line(line):
    line = line.strip()
    if not line:
        return None
    parts = line.split()
    if not parts:
        return None
    value_str = parts[0]
    try:
        return int(value_str)
    except ValueError:
        return None

reserve0 = parse_line(lines[0]) if len(lines) > 0 else None
reserve1 = parse_line(lines[1]) if len(lines) > 1 else None

if reserve0 is None or reserve1 is None:
    print("ERROR", file=sys.stderr)
    sys.exit(1)

print(f"{reserve0} {reserve1}")
PYEOF
    )
    
    if [ $? -eq 0 ] && [ ! -z "$RESERVE_DATA" ]; then
        RESERVE0=$(echo $RESERVE_DATA | awk '{print $1}')
        RESERVE1=$(echo $RESERVE_DATA | awk '{print $2}')
        
        # 获取 totalSupply 并解析（可能包含科学计数法格式）
        TOTAL_SUPPLY_RAW=$(cast call $PAIR_ADDRESS "totalSupply()(uint256)" --rpc-url $RPC_URL 2>/dev/null)
        TOTAL_SUPPLY=$(parse_lp_balance "$TOTAL_SUPPLY_RAW")
        
        if [ -z "$TOTAL_SUPPLY" ] || [ "$TOTAL_SUPPLY" = "0" ]; then
            echo "警告: totalSupply 为0，无法计算最小输出"
            AMOUNT0_MIN="0"
            AMOUNT1_MIN="0"
        else
            # 计算最小输出（考虑1%滑点）
            MIN_OUTPUTS=$(python3 <<EOF
lp_amount = int('$FUNDER_LP_BALANCE')
reserve0 = int('$RESERVE0')
reserve1 = int('$RESERVE1')
total_supply = int('$TOTAL_SUPPLY')

if total_supply == 0:
    print("0 0")
else:
    amount0 = (lp_amount * reserve0) // total_supply
    amount1 = (lp_amount * reserve1) // total_supply
    # 考虑1%滑点
    amount0_min = int(amount0 * 0.99)
    amount1_min = int(amount1 * 0.99)
    print(f"{amount0_min} {amount1_min}")
EOF
            )
            
            if [ -z "$MIN_OUTPUTS" ]; then
                echo "警告: 无法计算最小输出"
                AMOUNT0_MIN="0"
                AMOUNT1_MIN="0"
            else
                AMOUNT0_MIN=$(echo $MIN_OUTPUTS | awk '{print $1}')
                AMOUNT1_MIN=$(echo $MIN_OUTPUTS | awk '{print $2}')
            fi
        fi
    else
        echo "警告: 无法获取储备量"
        AMOUNT0_MIN="0"
        AMOUNT1_MIN="0"
    fi
else
    echo "警告: 无法获取储备量"
    AMOUNT0_MIN="0"
    AMOUNT1_MIN="0"
fi

echo "最小输出: Token0=$AMOUNT0_MIN, Token1=$AMOUNT1_MIN"
echo ""

# 步骤7: 确定token顺序（removeLiquidity要求tokenA < tokenB）
echo "步骤7: 确定token顺序..."
TOKEN_A=""
TOKEN_B=""
AMOUNT_A_MIN=""
AMOUNT_B_MIN=""

TOKEN_COMPARE=$(python3 <<EOF
token0 = "$TOKEN0_ADDRESS"
token1 = "$TOKEN1_ADDRESS"
if token0.lower() < token1.lower():
    print("0")
else:
    print("1")
EOF
)

if [ "$TOKEN_COMPARE" = "0" ]; then
    TOKEN_A=$TOKEN0_ADDRESS
    TOKEN_B=$TOKEN1_ADDRESS
    AMOUNT_A_MIN=$AMOUNT0_MIN
    AMOUNT_B_MIN=$AMOUNT1_MIN
else
    TOKEN_A=$TOKEN1_ADDRESS
    TOKEN_B=$TOKEN0_ADDRESS
    AMOUNT_A_MIN=$AMOUNT1_MIN
    AMOUNT_B_MIN=$AMOUNT0_MIN
fi

echo "Token A: $TOKEN_A"
echo "Token B: $TOKEN_B"
echo "最小输出 A: $AMOUNT_A_MIN"
echo "最小输出 B: $AMOUNT_B_MIN"
echo ""

# 步骤8: 移除流动性
echo "步骤8: 移除流动性..."
# 设置deadline（当前时间 + 20分钟）
DEADLINE=$(python3 <<EOF
import time
print(int(time.time()) + 1200)
EOF
)

REMOVE_CMD="cast send $ROUTER_ADDRESS \"removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)\" $TOKEN_A $TOKEN_B $FUNDER_LP_BALANCE $AMOUNT_A_MIN $AMOUNT_B_MIN $FUNDER_ADDRESS $DEADLINE --rpc-url $RPC_URL --private-key $FUNDER_PRIVATE_KEY"

if [ "$DRY_RUN" = false ]; then
    echo "执行移除流动性操作..."
    TX_OUTPUT=$(eval $REMOVE_CMD 2>&1)
    format_tx_output "$TX_OUTPUT"
else
    echo "命令: $REMOVE_CMD"
fi
echo ""

echo "=========================================="
echo "移除LP操作完成！"
echo "=========================================="