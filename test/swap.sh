#!/bin/bash

# PancakeSwap V2 Pair Swap 脚本
# 使用 200万个 Token1 换 Token0

# 配置参数
PAIR_ADDRESS="0xae81e69aa1e4f18eafd8a34c78d406af8fa65360"
SENDER_ADDRESS="0x73a56a2e0678bd275fC841191EDfF2f6A724F2b2"
TO_ADDRESS="0xf9eb1239D1ab5A5B3D176bFE7F4F5875407B2e86"
TOKEN1_AMOUNT="11000000000000000000000000"  # 1100万个 Token1 (假设18位小数，即 2000000 * 10^18)

# 可选: 如果无法自动获取，可以手动指定 token 地址
# 如果本地 fork 链上合约不存在，取消下面的注释并填入正确的地址
TOKEN0_ADDRESS="0x6a06Fc86F278F5B3a4E7Fd9297fD59fc2Dc99999"
TOKEN1_ADDRESS="0xC0EdcDdd6d5417c22467e3d5642Efa1820E454f8"

# 设置默认 RPC_URL
RPC_URL=${RPC_URL:-"http://localhost:8545"}

# 检查 PRIVATE_KEY 是否设置
if [ -z "$PRIVATE_KEY" ]; then
    echo "警告: PRIVATE_KEY 未设置，将只显示命令"
    DRY_RUN=true
else
    DRY_RUN=false
fi

echo "=========================================="
echo "PancakeSwap V2 Pair Swap 操作"
echo "=========================================="
echo "RPC URL: $RPC_URL"
echo "Pair 地址: $PAIR_ADDRESS"
echo "发送者地址: $SENDER_ADDRESS"
echo "接收者地址: $TO_ADDRESS"
echo "Token1 数量: $TOKEN1_AMOUNT (200万个)"
echo ""

# 步骤1: 获取 Token0 和 Token1 地址
echo "步骤1: 获取 Token0 和 Token1 地址..."

# 如果已经手动指定了 token 地址，直接使用
if [ ! -z "$TOKEN0_ADDRESS" ] && [ ! -z "$TOKEN1_ADDRESS" ]; then
    echo "使用手动指定的 token 地址:"
    echo "Token0 地址: $TOKEN0_ADDRESS"
    echo "Token1 地址: $TOKEN1_ADDRESS"
else
    # 尝试从合约获取
    echo "尝试从 pair 合约获取 token 地址..."
    
    # 使用超时调用，避免挂起
    TOKEN0_ADDRESS=$(timeout 5 cast call $PAIR_ADDRESS "token0()(address)" --rpc-url $RPC_URL 2>&1)
    CALL_EXIT_CODE=$?
    
    if [ $CALL_EXIT_CODE -eq 124 ]; then
        echo "警告: 调用 token0() 超时，合约可能在本地链上不存在"
        echo "提示: 如果是本地 fork 链，请先加载状态，或手动在脚本中指定 TOKEN0_ADDRESS 和 TOKEN1_ADDRESS"
        exit 1
    fi
    
    TOKEN1_ADDRESS=$(timeout 5 cast call $PAIR_ADDRESS "token1()(address)" --rpc-url $RPC_URL 2>&1)
    CALL_EXIT_CODE=$?
    
    if [ $CALL_EXIT_CODE -eq 124 ]; then
        echo "警告: 调用 token1() 超时，合约可能在本地链上不存在"
        echo "提示: 如果是本地 fork 链，请先加载状态，或手动在脚本中指定 TOKEN0_ADDRESS 和 TOKEN1_ADDRESS"
        exit 1
    fi
    
    # 检查是否有错误
    if echo "$TOKEN0_ADDRESS" | grep -qi "error\|revert\|failed"; then
        echo "错误: 调用 token0() 失败: $TOKEN0_ADDRESS"
        echo "提示: 如果是本地 fork 链，请先加载状态，或手动在脚本中指定 TOKEN0_ADDRESS 和 TOKEN1_ADDRESS"
        exit 1
    fi
    if echo "$TOKEN1_ADDRESS" | grep -qi "error\|revert\|failed"; then
        echo "错误: 调用 token1() 失败: $TOKEN1_ADDRESS"
        echo "提示: 如果是本地 fork 链，请先加载状态，或手动在脚本中指定 TOKEN0_ADDRESS 和 TOKEN1_ADDRESS"
        exit 1
    fi
    
    # 移除可能的空白字符
    TOKEN0_ADDRESS=$(echo "$TOKEN0_ADDRESS" | tr -d '[:space:]')
    TOKEN1_ADDRESS=$(echo "$TOKEN1_ADDRESS" | tr -d '[:space:]')
    
    if [ -z "$TOKEN0_ADDRESS" ] || [ "$TOKEN0_ADDRESS" = "0x0000000000000000000000000000000000000000" ] || [ "${#TOKEN0_ADDRESS}" -lt 42 ]; then
        echo "错误: 无法获取 Token0 地址 (返回: '$TOKEN0_ADDRESS')"
        echo "提示: 如果是本地 fork 链，请先加载状态，或手动在脚本中指定 TOKEN0_ADDRESS 和 TOKEN1_ADDRESS"
        exit 1
    fi
    if [ -z "$TOKEN1_ADDRESS" ] || [ "$TOKEN1_ADDRESS" = "0x0000000000000000000000000000000000000000" ] || [ "${#TOKEN1_ADDRESS}" -lt 42 ]; then
        echo "错误: 无法获取 Token1 地址 (返回: '$TOKEN1_ADDRESS')"
        echo "提示: 如果是本地 fork 链，请先加载状态，或手动在脚本中指定 TOKEN0_ADDRESS 和 TOKEN1_ADDRESS"
        exit 1
    fi
    echo "Token0 地址: $TOKEN0_ADDRESS"
    echo "Token1 地址: $TOKEN1_ADDRESS"
fi

# 检查 to 地址是否有效（不能是 token0、token1 或 pair 地址）
TO_ADDRESS_LOWER=$(echo "$TO_ADDRESS" | tr '[:upper:]' '[:lower:]')
TOKEN0_LOWER=$(echo "$TOKEN0_ADDRESS" | tr '[:upper:]' '[:lower:]')
TOKEN1_LOWER=$(echo "$TOKEN1_ADDRESS" | tr '[:upper:]' '[:lower:]')
PAIR_LOWER=$(echo "$PAIR_ADDRESS" | tr '[:upper:]' '[:lower:]')

if [ "$TO_ADDRESS_LOWER" = "$TOKEN0_LOWER" ] || [ "$TO_ADDRESS_LOWER" = "$TOKEN1_LOWER" ] || [ "$TO_ADDRESS_LOWER" = "$PAIR_LOWER" ]; then
    echo "警告: to 地址不能是 token0、token1 或 pair 地址，将使用 sender 地址作为替代"
    TO_ADDRESS=$SENDER_ADDRESS
    echo "使用新的 to 地址: $TO_ADDRESS"
fi
echo ""

# 步骤2: 检查 Token1 余额
echo "步骤2: 检查 Token1 余额..."
BALANCE=$(cast call $TOKEN1_ADDRESS "balanceOf(address)(uint256)" $SENDER_ADDRESS --rpc-url $RPC_URL 2>/dev/null)
echo "当前 Token1 余额: $BALANCE"
if [ ! -z "$BALANCE" ] && [ "$BALANCE" != "0" ]; then
    BALANCE_DECIMAL=$(cast --to-dec $BALANCE 2>/dev/null || echo "N/A")
    echo "余额 (十进制): $BALANCE_DECIMAL"
fi
echo ""

# 步骤3: 授权 pair 合约使用 Token1
echo "步骤3: 授权 pair 合约使用 Token1..."
APPROVE_CMD="cast send $TOKEN1_ADDRESS \"approve(address,uint256)\" $PAIR_ADDRESS $TOKEN1_AMOUNT --rpc-url $RPC_URL"
if [ "$DRY_RUN" = false ]; then
    APPROVE_CMD="$APPROVE_CMD --private-key $PRIVATE_KEY"
    echo "执行: $APPROVE_CMD"
    eval $APPROVE_CMD
else
    echo "命令: $APPROVE_CMD --private-key <PRIVATE_KEY>"
fi
echo ""

# 步骤4: 查询池子储备量
echo "步骤4: 查询池子储备量..."
RESERVES=$(cast call $PAIR_ADDRESS "getReserves()(uint112,uint112,uint32)" --rpc-url $RPC_URL 2>/dev/null)
if [ -z "$RESERVES" ]; then
    echo "错误: 无法获取池子储备量"
    exit 1
fi

echo "原始储备量数据:"
echo "$RESERVES"
echo ""

# 解析储备量 (cast call 返回多行格式，每行包含实际值和科学计数法)
# 格式示例:
# 775306587530406507419040765 [7.753e26]
# 1522182243021352678898928 [1.522e24]
# 1761981720 [1.761e9]
RESERVE_DATA=$(python3 <<PYEOF
import sys

# 读取多行输入
lines = '''$RESERVES'''.strip().split('\n')

if len(lines) < 2:
    print("ERROR: 储备量数据不足", file=sys.stderr)
    sys.exit(1)

# 解析每行，取第一个值（实际数值，忽略科学计数法表示）
def parse_line(line):
    line = line.strip()
    if not line:
        return None
    # 取第一个空格或方括号之前的值
    parts = line.split()
    if not parts:
        return None
    value_str = parts[0]
    try:
        return int(value_str)
    except ValueError:
        print(f"ERROR: 无法解析数字: {value_str}", file=sys.stderr)
        sys.exit(1)

reserve0 = parse_line(lines[0])
reserve1 = parse_line(lines[1])

if reserve0 is None or reserve1 is None:
    print("ERROR: 无法解析储备量", file=sys.stderr)
    sys.exit(1)

print(f"{reserve0} {reserve1}")
PYEOF
)

if [ $? -ne 0 ] || [ -z "$RESERVE_DATA" ]; then
    echo "错误: 无法解析池子储备量"
    exit 1
fi

RESERVE0=$(echo $RESERVE_DATA | awk '{print $1}')
RESERVE1=$(echo $RESERVE_DATA | awk '{print $2}')
echo "Reserve0 (Token0): $RESERVE0"
echo "Reserve1 (Token1): $RESERVE1"
echo ""

# 计算能换到多少 Token0 (使用恒定乘积公式，考虑手续费)
# PancakeSwap V2 使用 0.25% 手续费，公式: amount0Out = (amount1In * 9975 * reserve0) / ((reserve1 * 10000) + (amount1In * 9975))
echo "步骤5: 计算可换到的 Token0 数量..."
AMOUNT0_OUT=$(python3 <<EOF
amount1_in = int('$TOKEN1_AMOUNT')
reserve0 = int('$RESERVE0')
reserve1 = int('$RESERVE1')

# PancakeSwap V2 使用 0.25% 手续费 (9975/10000)
# 公式: amount0Out = (amount1In * 9975 * reserve0) / ((reserve1 * 10000) + (amount1In * 9975))
numerator = amount1_in * 9975 * reserve0
denominator = (reserve1 * 10000) + (amount1_in * 9975)
amount0_out = numerator // denominator

# 设置 1% 滑点保护 (实际输出可能略少)
amount0_out_min = int(amount0_out * 0.99)
print(amount0_out_min)
EOF
)

if [ -z "$AMOUNT0_OUT" ] || [ "$AMOUNT0_OUT" = "0" ]; then
    echo "错误: 无法计算输出数量，可能池子储备不足"
    exit 1
fi

echo "预计可换到 Token0: $AMOUNT0_OUT (已考虑 1% 滑点保护)"
echo ""

# 步骤6: 将 Token1 转账到 pair 合约
echo "步骤6: 将 Token1 转账到 pair 合约..."
TRANSFER_CMD="cast send $TOKEN1_ADDRESS \"transfer(address,uint256)\" $PAIR_ADDRESS $TOKEN1_AMOUNT --rpc-url $RPC_URL"
if [ "$DRY_RUN" = false ]; then
    TRANSFER_CMD="$TRANSFER_CMD --private-key $PRIVATE_KEY"
    echo "执行: $TRANSFER_CMD"
    eval $TRANSFER_CMD
else
    echo "命令: $TRANSFER_CMD --private-key <PRIVATE_KEY>"
fi
echo ""

# 步骤7: 执行 swap (用 Token1 换 Token0)
# swap(uint256 amount0Out, uint256 amount1Out, address to, bytes data)
# amount0Out: 要输出的 Token0 数量 (必须 > 0)
# amount1Out: 0 (因为我们要输入 Token1，不是输出 Token1)
# to: 接收地址
# data: 空字节 "0x"
echo "步骤7: 执行 swap 操作 (用 Token1 换 Token0)..."
SWAP_CMD="cast send $PAIR_ADDRESS \"swap(uint256,uint256,address,bytes)\" $AMOUNT0_OUT 0 $TO_ADDRESS \"0x\" --rpc-url $RPC_URL"
if [ "$DRY_RUN" = false ]; then
    SWAP_CMD="$SWAP_CMD --private-key $PRIVATE_KEY"
    echo "执行: $SWAP_CMD"
    eval $SWAP_CMD
else
    echo "命令: $SWAP_CMD --private-key <PRIVATE_KEY>"
fi
echo ""

echo "=========================================="
echo "操作完成！"
echo "=========================================="
