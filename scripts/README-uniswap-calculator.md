# PancakeSwap Pair 计算器

这个脚本用于查询PancakeSwap V2 Pair的储备量、计算token价格，以及根据目标储备量计算所需的输入token数量。

## 功能

1. **查询储备数量**: 查询指定Pair合约中两个token的当前储备量
2. **计算K值**: 根据当前储备量计算恒定乘积K值
3. **计算Token价格**: 根据储备量比例计算token的相对价格
4. **计算输入量（不考虑手续费）**: 根据目标token储备量，计算需要输入的另一个token数量
5. **计算输入量（考虑手续费）**: 考虑0.25%手续费后，计算需要输入的另一个token数量

## 使用方法

### 1. 配置参数

可以通过环境变量或直接修改脚本中的`CONFIG`对象来配置参数：

```bash
# 方式1: 使用环境变量
export RPC_URL="https://rpc.ankr.com/bsc/82c596812c311f4cc184598a378663a680bb171972733faef7b8ab81fc9cc626"
export PAIR_ADDRESS="0x..."  # PancakeSwap Pair地址
export TARGET_RESERVE="50%"  # 目标token储备量（百分比或绝对数值）
export TARGET_TOKEN_INDEX="0"  # 0或1，表示目标token是token0还是token1
export TOKEN0_DECIMALS="18"
export TOKEN1_DECIMALS="18"

# 方式2: 直接修改脚本中的CONFIG对象
```

**TARGET_RESERVE 示例**:
- `"50%"` - 让储备量变成当前的50%
- `"80%"` - 让储备量变成当前的80%  
- `"200000000000000000000"` - 让储备量变成200个token（绝对数值）

### 2. 运行脚本

```bash
node scripts/uniswap-pair-calculator.js
```

## 配置说明

- **RPC_URL**: BSC RPC节点地址
  - 默认使用Ankr的BSC RPC
  - 也可以使用其他BSC RPC节点

- **PAIR_ADDRESS**: PancakeSwap V2 Pair合约地址
  - 可以在PancakeSwap前端或BscScan上查找

- **TARGET_RESERVE**: 目标token的储备量，支持两种格式：
  - **百分比格式**: 如 `"50%"` 表示当前储备量的50%，`"150%"` 表示当前储备量的150%
  - **绝对数值格式**: 如 `"200000000000000000000"` 表示200个token (200 * 10^18)
  - 示例:
    - `"50%"` - 让储备量变成当前的50%
    - `"80%"` - 让储备量变成当前的80%
    - `"200000000000000000000"` - 让储备量变成200个token（绝对数值）

- **TARGET_TOKEN_INDEX**: 目标token索引
  - `0`: 表示目标是token0
  - `1`: 表示目标是token1

- **TOKEN0_DECIMALS / TOKEN1_DECIMALS**: Token精度
  - 大多数ERC20 token使用18位小数
  - USDT使用6位小数

## 计算公式

### 恒定乘积公式

PancakeSwap V2使用恒定乘积做市商模型：

```
K = Reserve0 × Reserve1
```

### 价格计算

```
Token0价格 (以Token1计价) = Reserve1 / Reserve0
Token1价格 (以Token0计价) = Reserve0 / Reserve1
```

### 输入量计算（不考虑手续费）

假设目标是token0达到targetReserve0：

```
新Reserve1 = K / targetReserve0
需要输入的Token1 = 新Reserve1 - 当前Reserve1
```

### 输入量计算（考虑手续费）

```
新Reserve1 = K / targetReserve0
需要增加的Reserve1 = 新Reserve1 - 当前Reserve1
需要输入的Token1 = 需要增加的Reserve1 / (1 - feeRate)  // feeRate = 0.0025 (0.25%)

实际进入池子的Token1 = 需要输入的Token1 × (1 - feeRate)
实际输出的Token0 = (当前Reserve0 × 实际进入的Token1) / (当前Reserve1 + 实际进入的Token1)
```

## 示例输出

```
============================================================
PancakeSwap V2 Pair 计算器
============================================================
Pair地址: 0x...
RPC URL: https://rpc.ankr.com/bsc/...

1. 查询当前储备数量...
   Reserve0: 123456789.123456789
   Reserve1: 987654321.987654321

2. 计算当前K值...
   K = Reserve0 × Reserve1 = 121932631112635269
   K值 (格式化): 1.21932e17

3. 当前Token价格...
   Token0价格 (以Token1计价): 8.00000000
   Token1价格 (以Token0计价): 0.12500000

4. 计算达到目标储备量所需的输入量（不考虑手续费）...
   目标Token0储备量: 50% (100.0 Token0)
   需要输入Token1数量: 1500.0
   交易后Token0储备: 100.0
   交易后Token1储备: 609663155.563176345
   交易后K值: 1.21932e17 (应该等于初始K)
   K值变化: 0.00000000%

5. 计算达到目标储备量所需的输入量（考虑手续费，费率: 0.25%）...
   目标Token0储备量: 50% (100.0 Token0)
   需要输入Token1数量: 1503.759398496240601
   实际进入池子的Token1数量: 1500.0 (扣除手续费)
   手续费: 3.759398496240601 Token1
   交易后Token0储备: 99.506234567 Token0
   交易后Token1储备: 609663155.563176345
   交易后K值: 1.21932e17 (应该大于初始K)
   K值变化: 0.00000000%

============================================================
计算完成！
============================================================
```

## 注意事项

1. 确保RPC节点可用且有足够的请求配额
2. 目标储备量需要使用原始单位（不含小数位）
3. 手续费率默认为0.25%，这是PancakeSwap V2的标准费率
4. 计算结果可能与实际链上交易略有差异，因为储备量会实时变化
5. 如果目标是让某个token的储备量**增加**，需要通过添加流动性实现，而不是swap
6. Swap操作会让目标token的储备量**减少**（用另一个token换取目标token）

