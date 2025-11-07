#!/bin/bash

# Fork 网络 receiveBNB 测试脚本
# 创建10个账号，每个账号接收1.002 BNB，然后调用 receiveBNB 函数发送1个BNB
# 主账号调用 receiveBNB 发送10万BNB
# 然后将所有账号的LP转给主账号，主账号通过 PancakeSwap V2 Router 移除流动性，统计WBNB余额

# 配置参数
CONTRACT_ADDRESS="0x0193ED902BB984725c7AB939719FAD465a22C5A0"
PAIR_ADDRESS="0xc3311152e8c75fe80db5debf2008dd3f4fc2e121"  # LP交易池地址
NUM_ACCOUNTS=5
BNB_PER_ACCOUNT="1.005"  # 每个账号接收的BNB数量
BNB_TO_SEND="1.0"        # 调用 receiveBNB 时发送的BNB数量

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
echo "Fork 网络 receiveBNB 测试脚本"
echo "=========================================="
echo "RPC URL: $RPC_URL"
echo "合约地址: $CONTRACT_ADDRESS"
echo "Pair 地址: $PAIR_ADDRESS"
echo "创建账号数量: $NUM_ACCOUNTS"
echo "每个账号接收: $BNB_PER_ACCOUNT BNB"
echo "调用 receiveBNB 发送: $BNB_TO_SEND BNB"
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
    
    # 计算所需余额
    # 需要：给子账号转账 + 主账号调用 receiveBNB (10万BNB)
    REQUIRED_BALANCE=$(python3 <<EOF
accounts = $NUM_ACCOUNTS
bnb_per_account = $BNB_PER_ACCOUNT
main_bnb = 100000  # 主账号调用 receiveBNB 需要 10万 BNB
required = accounts * bnb_per_account + main_bnb
print(required)
EOF
)
    
    if [ "$FUNDER_BALANCE_ETH" != "N/A" ]; then
        BALANCE_CHECK=$(python3 <<EOF
balance = float('$FUNDER_BALANCE_ETH')
required = float('$REQUIRED_BALANCE')
if balance < required:
    print("WARNING")
else:
    print("OK")
EOF
)
        if [ "$BALANCE_CHECK" = "WARNING" ]; then
            echo "警告: 资金提供者余额不足，需要至少 $REQUIRED_BALANCE BNB"
            echo "  (包括: $NUM_ACCOUNTS 个账号 × $BNB_PER_ACCOUNT BNB + 主账号 100000 BNB)"
            echo "继续执行..."
        fi
    fi
fi
echo ""

# 步骤2: 创建账号
echo "步骤2: 创建 $NUM_ACCOUNTS 个账号..."
ACCOUNTS_FILE=$(mktemp)
ACCOUNTS_PRIVATE_KEYS=()

for i in $(seq 1 $NUM_ACCOUNTS); do
    # 生成随机私钥（32字节 = 64个十六进制字符）
    # 使用 openssl 生成随机字节，然后转换为十六进制
    RANDOM_BYTES=$(openssl rand -hex 32)
    ACCOUNT_PRIVATE_KEY="0x$RANDOM_BYTES"
    
    # 从私钥获取地址
    ACCOUNT_ADDRESS=$(cast wallet address --private-key $ACCOUNT_PRIVATE_KEY 2>/dev/null)
    
    if [ -z "$ACCOUNT_ADDRESS" ]; then
        echo "错误: 无法从私钥获取账号 $i 的地址"
        exit 1
    fi
    
    # 验证地址格式
    if [ "${#ACCOUNT_ADDRESS}" -ne 42 ] || [ "${ACCOUNT_ADDRESS:0:2}" != "0x" ]; then
        echo "错误: 账号 $i 地址格式无效: $ACCOUNT_ADDRESS"
        exit 1
    fi
    
    ACCOUNTS_PRIVATE_KEYS+=("$ACCOUNT_PRIVATE_KEY")
    echo "$ACCOUNT_ADDRESS|$ACCOUNT_PRIVATE_KEY" >> "$ACCOUNTS_FILE"
    echo "  账号 $i: $ACCOUNT_ADDRESS"
done
echo "✓ 已创建 $NUM_ACCOUNTS 个账号"
echo ""

# 步骤3: 向每个账号发送 BNB
echo "步骤3: 向每个账号发送 $BNB_PER_ACCOUNT BNB..."
BNB_PER_ACCOUNT_WEI=$(cast --to-wei $BNB_PER_ACCOUNT ether 2>/dev/null)
if [ -z "$BNB_PER_ACCOUNT_WEI" ]; then
    echo "错误: 无法转换 BNB 数量"
    exit 1
fi

ACCOUNT_INDEX=0
while IFS='|' read -r ACCOUNT_ADDRESS ACCOUNT_PRIVATE_KEY; do
    ACCOUNT_INDEX=$((ACCOUNT_INDEX + 1))
    echo -n "账号 $ACCOUNT_INDEX/$NUM_ACCOUNTS: $ACCOUNT_ADDRESS... "
    
    SEND_CMD="cast send $ACCOUNT_ADDRESS --value $BNB_PER_ACCOUNT_WEI --rpc-url $RPC_URL --private-key $FUNDER_PRIVATE_KEY"
    
    if [ "$DRY_RUN" = false ]; then
        TX_OUTPUT=$(eval $SEND_CMD 2>&1)
        format_tx_output "$TX_OUTPUT"
        # 短暂延迟避免 nonce 冲突
        sleep 0.1
    else
        echo ""
        echo "    命令: $SEND_CMD"
    fi
done < "$ACCOUNTS_FILE"
echo ""

# 步骤4: 每个账号调用 receiveBNB
echo "步骤4: 每个账号调用 receiveBNB 发送 $BNB_TO_SEND BNB..."
BNB_TO_SEND_WEI=$(cast --to-wei $BNB_TO_SEND ether 2>/dev/null)
if [ -z "$BNB_TO_SEND_WEI" ]; then
    echo "错误: 无法转换 BNB 数量"
    exit 1
fi

ACCOUNT_INDEX=0
while IFS='|' read -r ACCOUNT_ADDRESS ACCOUNT_PRIVATE_KEY; do
    ACCOUNT_INDEX=$((ACCOUNT_INDEX + 1))
    echo -n "账号 $ACCOUNT_INDEX/$NUM_ACCOUNTS: $ACCOUNT_ADDRESS... "
    
    # 调用 receiveBNB(address sender)，带重试机制（最多3次）
    CALL_CMD="cast send $CONTRACT_ADDRESS \"receiveBNB(address)\" $ACCOUNT_ADDRESS --value $BNB_TO_SEND_WEI --rpc-url $RPC_URL --private-key $ACCOUNT_PRIVATE_KEY"
    
    if [ "$DRY_RUN" = false ]; then
        RETRY_COUNT=0
        MAX_RETRIES=3
        SUCCESS=false
        
        while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            TX_OUTPUT=$(eval $CALL_CMD 2>&1)
            
            # 检查是否成功
            if ! echo "$TX_OUTPUT" | grep -qi "error\|revert\|failed"; then
                format_tx_output "$TX_OUTPUT"
                SUCCESS=true
                break
            else
                RETRY_COUNT=$((RETRY_COUNT + 1))
                if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                    echo -n "(重试 $RETRY_COUNT/$MAX_RETRIES) "
                    sleep 0.5  # 重试前等待
                else
                    format_tx_output "$TX_OUTPUT"
                fi
            fi
        done
        
        # 短暂延迟避免 nonce 冲突
        sleep 0.1
    else
        echo ""
        echo "    命令: $CALL_CMD"
    fi
done < "$ACCOUNTS_FILE"
echo ""

# 步骤5: 主账号调用 receiveBNB 发送 10 万 BNB
echo "步骤5: 主账号调用 receiveBNB 发送 100000 BNB..."
MAIN_BNB_AMOUNT="100000"
MAIN_BNB_AMOUNT_WEI=$(cast --to-wei $MAIN_BNB_AMOUNT ether 2>/dev/null)
if [ -z "$MAIN_BNB_AMOUNT_WEI" ]; then
    echo "错误: 无法转换 BNB 数量"
    exit 1
fi

echo -n "主账号: $FUNDER_ADDRESS... "

# 调用 receiveBNB(address sender)，参数为主账号地址
MAIN_CALL_CMD="cast send $CONTRACT_ADDRESS \"receiveBNB(address)\" $FUNDER_ADDRESS --value $MAIN_BNB_AMOUNT_WEI --rpc-url $RPC_URL --private-key $FUNDER_PRIVATE_KEY"

if [ "$DRY_RUN" = false ]; then
    TX_OUTPUT=$(eval $MAIN_CALL_CMD 2>&1)
    format_tx_output "$TX_OUTPUT"
    sleep 0.1
else
    echo ""
    echo "    命令: $MAIN_CALL_CMD"
fi
echo ""

# 步骤6: 获取 Pair 合约的 token0 和 token1 地址
echo "步骤6: 获取 Pair 合约信息..."
TOKEN0_ADDRESS=$(cast call $PAIR_ADDRESS "token0()(address)" --rpc-url $RPC_URL 2>/dev/null | tr -d '[:space:]')
TOKEN1_ADDRESS=$(cast call $PAIR_ADDRESS "token1()(address)" --rpc-url $RPC_URL 2>/dev/null | tr -d '[:space:]')

if [ -z "$TOKEN0_ADDRESS" ] || [ -z "$TOKEN1_ADDRESS" ]; then
    echo "错误: 无法获取 token 地址"
    exit 1
fi

echo "Token0 地址: $TOKEN0_ADDRESS"
echo "Token1 地址: $TOKEN1_ADDRESS"
echo ""

# 步骤7: 获取 Router 地址
echo "步骤7: 获取 Router 地址..."
ROUTER_ADDRESS=$(cast call $CONTRACT_ADDRESS "router()(address)" --rpc-url $RPC_URL 2>/dev/null | tr -d '[:space:]')
if [ -z "$ROUTER_ADDRESS" ]; then
    echo "错误: 无法获取 Router 地址"
    exit 1
fi
echo "Router 地址: $ROUTER_ADDRESS"
echo ""

# 步骤7.5: 打印所有账号的LP数量
echo "步骤7.5: 打印所有账号的LP数量..."
ACCOUNT_INDEX=0
while IFS='|' read -r ACCOUNT_ADDRESS ACCOUNT_PRIVATE_KEY; do
    ACCOUNT_INDEX=$((ACCOUNT_INDEX + 1))
    
    # 查询账号的LP余额
    LP_BALANCE_RAW=$(cast call $PAIR_ADDRESS "balanceOf(address)(uint256)" $ACCOUNT_ADDRESS --rpc-url $RPC_URL 2>/dev/null)
    LP_BALANCE=$(parse_lp_balance "$LP_BALANCE_RAW")
    
    if [ -z "$LP_BALANCE" ] || [ "$LP_BALANCE" = "0" ]; then
        echo "  账号 $ACCOUNT_INDEX/$NUM_ACCOUNTS: $ACCOUNT_ADDRESS - LP余额: 0"
    else
        LP_BALANCE_ETH=$(cast --to-unit $LP_BALANCE ether 2>/dev/null || echo "N/A")
        echo "  账号 $ACCOUNT_INDEX/$NUM_ACCOUNTS: $ACCOUNT_ADDRESS - LP余额: $LP_BALANCE ($LP_BALANCE_ETH)"
    fi
done < "$ACCOUNTS_FILE"
echo ""

# 步骤8: 将所有账号的LP转给主账号
echo "步骤8: 将所有账号的LP转给主账号..."
ACCOUNT_INDEX=0
TOTAL_LP=0
while IFS='|' read -r ACCOUNT_ADDRESS ACCOUNT_PRIVATE_KEY; do
    ACCOUNT_INDEX=$((ACCOUNT_INDEX + 1))
    
    # 查询账号的LP余额
    LP_BALANCE_RAW=$(cast call $PAIR_ADDRESS "balanceOf(address)(uint256)" $ACCOUNT_ADDRESS --rpc-url $RPC_URL 2>/dev/null)
    LP_BALANCE=$(parse_lp_balance "$LP_BALANCE_RAW")
    
    if [ -z "$LP_BALANCE" ] || [ "$LP_BALANCE" = "0" ]; then
        echo "账号 $ACCOUNT_INDEX/$NUM_ACCOUNTS: $ACCOUNT_ADDRESS - LP余额为0，跳过"
        continue
    fi
    
    echo -n "账号 $ACCOUNT_INDEX/$NUM_ACCOUNTS: $ACCOUNT_ADDRESS... "
    
    # 将LP转给主账号
    TRANSFER_CMD="cast send $PAIR_ADDRESS \"transfer(address,uint256)\" $FUNDER_ADDRESS $LP_BALANCE --rpc-url $RPC_URL --private-key $ACCOUNT_PRIVATE_KEY"
    
    if [ "$DRY_RUN" = false ]; then
        TX_OUTPUT=$(eval $TRANSFER_CMD 2>&1)
        if format_tx_output "$TX_OUTPUT"; then
            # 累加LP数量
            TOTAL_LP=$(python3 <<EOF
total = int('$TOTAL_LP') if '$TOTAL_LP' else 0
lp = int('$LP_BALANCE')
print(total + lp)
EOF
)
        else
            # 如果失败，输出详细错误信息用于调试
            ERROR_MSG=$(echo "$TX_OUTPUT" | grep -iE "error|revert|failed|reason" | head -5)
            if [ ! -z "$ERROR_MSG" ]; then
                echo ""
                echo "    错误详情: $ERROR_MSG"
            fi
        fi
        sleep 0.1
    else
        echo ""
        echo "    命令: $TRANSFER_CMD"
    fi
done < "$ACCOUNTS_FILE"
echo ""

# 步骤9: 主账号通过 PancakeSwap V2 Router 移除流动性
echo "步骤9: 主账号通过 PancakeSwap V2 Router 移除流动性..."
# 查询主账号的LP余额
FUNDER_LP_BALANCE_RAW=$(cast call $PAIR_ADDRESS "balanceOf(address)(uint256)" $FUNDER_ADDRESS --rpc-url $RPC_URL 2>/dev/null)
FUNDER_LP_BALANCE=$(parse_lp_balance "$FUNDER_LP_BALANCE_RAW")

if [ -z "$FUNDER_LP_BALANCE" ] || [ "$FUNDER_LP_BALANCE" = "0" ]; then
    echo "警告: 主账号LP余额为0，无法移除流动性"
else
    FUNDER_LP_BALANCE_ETH=$(cast --to-unit $FUNDER_LP_BALANCE ether 2>/dev/null || echo "N/A")
    echo "主账号LP余额: $FUNDER_LP_BALANCE ($FUNDER_LP_BALANCE_ETH)"
    
    # 授权 Router 使用 LP
    echo -n "授权 Router 使用 LP... "
    APPROVE_CMD="cast send $PAIR_ADDRESS \"approve(address,uint256)\" $ROUTER_ADDRESS $FUNDER_LP_BALANCE --rpc-url $RPC_URL --private-key $FUNDER_PRIVATE_KEY"
    
    if [ "$DRY_RUN" = false ]; then
        TX_OUTPUT=$(eval $APPROVE_CMD 2>&1)
        format_tx_output "$TX_OUTPUT"
        sleep 0.1
    else
        echo ""
        echo "    命令: $APPROVE_CMD"
    fi
    
    # 获取当前储备量以计算最小输出
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
                echo "警告: totalSupply 为0，无法计算最小输出，跳过移除流动性"
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
                    echo "警告: 无法计算最小输出，跳过移除流动性"
                else
                    AMOUNT0_MIN=$(echo $MIN_OUTPUTS | awk '{print $1}')
                    AMOUNT1_MIN=$(echo $MIN_OUTPUTS | awk '{print $2}')
                    
                    # 设置deadline（当前时间 + 20分钟）
                    DEADLINE=$(python3 <<EOF
import time
print(int(time.time()) + 1200)
EOF
)
                    
                    # 确定token顺序（removeLiquidity要求tokenA < tokenB）
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
                    
                    echo -n "移除流动性... "
                    REMOVE_CMD="cast send $ROUTER_ADDRESS \"removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)\" $TOKEN_A $TOKEN_B $FUNDER_LP_BALANCE $AMOUNT_A_MIN $AMOUNT_B_MIN $FUNDER_ADDRESS $DEADLINE --rpc-url $RPC_URL --private-key $FUNDER_PRIVATE_KEY"
                    
                    if [ "$DRY_RUN" = false ]; then
                        TX_OUTPUT=$(eval $REMOVE_CMD 2>&1)
                        format_tx_output "$TX_OUTPUT"
                    else
                        echo ""
                        echo "    命令: $REMOVE_CMD"
                    fi
                fi
            fi
        else
            echo "警告: 无法获取储备量，跳过移除流动性"
        fi
    fi
fi
echo ""

# 步骤9.5: 将 TOKEN 换回 WBNB
echo "步骤9.5: 将 TOKEN 换回 WBNB..."
# 获取 TOKEN 地址
TOKEN_ADDRESS=$(cast call $CONTRACT_ADDRESS "tokenAddress()(address)" --rpc-url $RPC_URL 2>/dev/null | tr -d '[:space:]')
if [ -z "$TOKEN_ADDRESS" ]; then
    echo "警告: 无法获取 TOKEN 地址，跳过交换"
else
    echo "TOKEN 地址: $TOKEN_ADDRESS"
    
    # 获取 WBNB 地址
    WBNB_ADDRESS_FOR_SWAP=$(cast call $CONTRACT_ADDRESS "wbnbAddress()(address)" --rpc-url $RPC_URL 2>/dev/null | tr -d '[:space:]')
    if [ -z "$WBNB_ADDRESS_FOR_SWAP" ]; then
        WBNB_ADDRESS_FOR_SWAP=$TOKEN0_ADDRESS
    fi
    echo "WBNB 地址: $WBNB_ADDRESS_FOR_SWAP"
    
    # 查询主账号的 TOKEN 余额
    TOKEN_BALANCE_RAW=$(cast call $TOKEN_ADDRESS "balanceOf(address)(uint256)" $FUNDER_ADDRESS --rpc-url $RPC_URL 2>/dev/null)
    TOKEN_BALANCE=$(parse_lp_balance "$TOKEN_BALANCE_RAW")
    
    if [ -z "$TOKEN_BALANCE" ] || [ "$TOKEN_BALANCE" = "0" ]; then
        echo "主账号 TOKEN 余额为0，跳过交换"
    else
        TOKEN_BALANCE_ETH=$(cast --to-unit $TOKEN_BALANCE ether 2>/dev/null || echo "N/A")
        echo "主账号 TOKEN 余额: $TOKEN_BALANCE ($TOKEN_BALANCE_ETH)"
        
        # 授权 Router 使用 TOKEN
        echo -n "授权 Router 使用 TOKEN... "
        APPROVE_TOKEN_CMD="cast send $TOKEN_ADDRESS \"approve(address,uint256)\" $ROUTER_ADDRESS $TOKEN_BALANCE --rpc-url $RPC_URL --private-key $FUNDER_PRIVATE_KEY"
        
        if [ "$DRY_RUN" = false ]; then
            TX_OUTPUT=$(eval $APPROVE_TOKEN_CMD 2>&1)
            format_tx_output "$TX_OUTPUT"
            sleep 0.1
        else
            echo ""
            echo "    命令: $APPROVE_TOKEN_CMD"
        fi
        
        # 获取当前储备量以计算最小输出
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
                
                # 确定哪个是 TOKEN，哪个是 WBNB
                TOKEN_RESERVE=""
                WBNB_RESERVE=""
                
                if [ "$TOKEN0_ADDRESS" = "$TOKEN_ADDRESS" ]; then
                    TOKEN_RESERVE=$RESERVE0
                    WBNB_RESERVE=$RESERVE1
                elif [ "$TOKEN1_ADDRESS" = "$TOKEN_ADDRESS" ]; then
                    TOKEN_RESERVE=$RESERVE1
                    WBNB_RESERVE=$RESERVE0
                else
                    echo "警告: 无法确定 TOKEN 在池子中的位置"
                    TOKEN_RESERVE=""
                fi
                
                if [ ! -z "$TOKEN_RESERVE" ] && [ "$TOKEN_RESERVE" != "0" ]; then
                    # 计算最小输出（考虑1%滑点，PancakeSwap V2 使用 0.25% 手续费）
                    # 公式: amountOut = (amountIn * 9975 * reserveOut) / ((reserveIn * 10000) + (amountIn * 9975))
                    AMOUNT_OUT_MIN=$(python3 <<EOF
amount_in = int('$TOKEN_BALANCE')
reserve_in = int('$TOKEN_RESERVE')
reserve_out = int('$WBNB_RESERVE')

# PancakeSwap V2 使用 0.25% 手续费 (9975/10000)
numerator = amount_in * 9975 * reserve_out
denominator = (reserve_in * 10000) + (amount_in * 9975)
amount_out = numerator // denominator

# 考虑1%滑点保护
amount_out_min = int(amount_out * 0.99)
print(amount_out_min)
EOF
)
                    
                    # 设置deadline（当前时间 + 20分钟）
                    DEADLINE=$(python3 <<EOF
import time
print(int(time.time()) + 1200)
EOF
)
                    
                    # 构建路径 [TOKEN, WBNB]
                    echo -n "交换 TOKEN 为 WBNB (最小输出: $AMOUNT_OUT_MIN)... "
                    SWAP_CMD="cast send $ROUTER_ADDRESS \"swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)\" $TOKEN_BALANCE $AMOUNT_OUT_MIN \"[$TOKEN_ADDRESS,$WBNB_ADDRESS_FOR_SWAP]\" $FUNDER_ADDRESS $DEADLINE --rpc-url $RPC_URL --private-key $FUNDER_PRIVATE_KEY"
                    
                    if [ "$DRY_RUN" = false ]; then
                        TX_OUTPUT=$(eval $SWAP_CMD 2>&1)
                        format_tx_output "$TX_OUTPUT"
                    else
                        echo ""
                        echo "    命令: $SWAP_CMD"
                    fi
                else
                    echo "警告: 无法计算最小输出，跳过交换"
                fi
            else
                echo "警告: 无法获取储备量，跳过交换"
            fi
        else
            echo "警告: 无法获取储备量，跳过交换"
        fi
    fi
fi
echo ""

# 步骤10: 统计主账号WBNB余额
echo "步骤10: 统计主账号WBNB余额..."
# 从合约获取WBNB地址
WBNB_ADDRESS=$(cast call $CONTRACT_ADDRESS "wbnbAddress()(address)" --rpc-url $RPC_URL 2>/dev/null | tr -d '[:space:]')
if [ -z "$WBNB_ADDRESS" ]; then
    # 如果无法获取，使用token0（通常token0是WBNB）
    WBNB_ADDRESS=$TOKEN0_ADDRESS
    echo "使用 Token0 作为 WBNB 地址: $WBNB_ADDRESS"
else
    echo "WBNB 地址: $WBNB_ADDRESS"
fi

WBNB_BALANCE=$(cast call $WBNB_ADDRESS "balanceOf(address)(uint256)" $FUNDER_ADDRESS --rpc-url $RPC_URL 2>/dev/null | tr -d '[:space:]')

if [ ! -z "$WBNB_BALANCE" ] && [ "$WBNB_BALANCE" != "0" ]; then
    WBNB_BALANCE_ETH=$(cast --to-unit $WBNB_BALANCE ether 2>/dev/null || echo "N/A")
    echo "主账号 WBNB 余额: $WBNB_BALANCE_ETH BNB"
    echo "主账号 WBNB 余额 (Wei): $WBNB_BALANCE"
else
    echo "主账号 WBNB 余额: 0"
fi
echo ""

echo "=========================================="
echo "所有操作完成！"
echo "=========================================="
echo ""
echo "创建的账号信息:"
ACCOUNT_INDEX=0
while IFS='|' read -r ACCOUNT_ADDRESS ACCOUNT_PRIVATE_KEY; do
    ACCOUNT_INDEX=$((ACCOUNT_INDEX + 1))
    echo "  账号 $ACCOUNT_INDEX:"
    echo "    地址: $ACCOUNT_ADDRESS"
    echo "    私钥: $ACCOUNT_PRIVATE_KEY"
done < "$ACCOUNTS_FILE"
echo ""

# 清理临时文件
rm -f "$ACCOUNTS_FILE"

