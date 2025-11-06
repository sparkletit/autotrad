# PancakeSwap V2 Pair Swap 命令

## 参数配置
- RPC URL: `http://localhost:8545` (默认值，可通过环境变量 `RPC_URL` 覆盖)
- Pair 地址: `0xae81e69aa1e4f18eafd8a34c78d406af8fa65360`
- Sender 地址: `0x73a56a2e0678bd275fC841191EDfF2f6A724F2b2`
- To 地址: `0x6a06fc86f278f5b3a4e7fd9297fd59fc2dc99999`
- Token1 数量: `2000000000000000000000000` (200万个，假设18位小数)

## 操作步骤

### 1. 获取 Token1 地址
```bash
cast call 0xae81e69aa1e4f18eafd8a34c78d406af8fa65360 "token1()(address)" --rpc-url $RPC_URL
```

假设获取到的 Token1 地址为 `$TOKEN1_ADDRESS`

### 2. 授权 pair 合约使用 Token1
```bash
cast send $TOKEN1_ADDRESS "approve(address,uint256)" 0xae81e69aa1e4f18eafd8a34c78d406af8fa65360 2000000000000000000000000 --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

### 3. 查询池子储备量
```bash
cast call 0xae81e69aa1e4f18eafd8a34c78d406af8fa65360 "getReserves()(uint112,uint112,uint32)" --rpc-url $RPC_URL
```

假设返回值为 `reserve0 reserve1 timestamp`

### 4. 计算可换到的 Token0 数量

**重要**: 不能将 `amount0Out` 设为 0，必须根据池子储备量计算。

PancakeSwap V2 使用恒定乘积公式，手续费为 0.25%：
```
amount0Out = (amount1In * 9975 * reserve0) / ((reserve1 * 10000) + (amount1In * 9975))
```

可以使用 Python 计算：
```python
amount1_in = 2000000000000000000000000
reserve0 = <从步骤3获取>
reserve1 = <从步骤3获取>
amount0_out = (amount1_in * 9975 * reserve0) // ((reserve1 * 10000) + (amount1_in * 9975))
# 建议设置 1% 滑点保护
amount0_out_min = int(amount0_out * 0.99)
```

假设计算出的 `amount0Out` 为 `$AMOUNT0_OUT`

### 5. 将 Token1 转账到 pair 合约
```bash
cast send $TOKEN1_ADDRESS "transfer(address,uint256)" 0xae81e69aa1e4f18eafd8a34c78d406af8fa65360 2000000000000000000000000 --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

### 6. 执行 swap 操作 (用 Token1 换 Token0)
```bash
cast send 0xae81e69aa1e4f18eafd8a34c78d406af8fa65360 "swap(uint256,uint256,address,bytes)" $AMOUNT0_OUT 0 0x6a06fc86f278f5b3a4e7fd9297fd59fc2dc99999 "0x" --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

## 参数说明

### swap 函数参数
- `amount0Out`: **必须 > 0** - 要输出的 Token0 数量（需要根据池子储备量计算，不能设为 0）
- `amount1Out`: `0` - 要输出的 Token1 数量（设为0，因为我们要输入 Token1）
- `to`: `0x6a06fc86f278f5b3a4e7fd9297fd59fc2dc99999` - 接收 Token0 的地址
- `data`: `0x` - 空字节数据

**注意**: 如果 `amount0Out` 和 `amount1Out` 都为 0，swap 函数会失败并返回 `INSUFFICIENT_OUTPUT_AMOUNT` 错误。

## 注意事项

1. **Token 精度**: 假设 Token1 有 18 位小数，200万个 = `2000000 * 10^18 = 2000000000000000000000000`
   - 如果 Token1 的精度不同，需要相应调整数量
   - 可以通过调用 `cast call $TOKEN1_ADDRESS "decimals()(uint8)" --rpc-url $RPC_URL` 查看精度

2. **余额检查**: 在执行前建议检查余额
   ```bash
   cast call $TOKEN1_ADDRESS "balanceOf(address)(uint256)" 0x73a56a2e0678bd275fC841191EDfF2f6A724F2b2 --rpc-url $RPC_URL
   ```

3. **授权检查**: 如果之前已经授权过足够的额度，可以跳过步骤2

4. **Gas 费用**: 确保账户有足够的 ETH/BNB 支付 gas 费用

5. **滑点保护**: 脚本中已包含 1% 的滑点保护（计算时使用 99% 的预期输出）。如果池子流动性不足或价格波动较大，可能需要调整滑点保护比例。

6. **错误处理**: 如果遇到 `INSUFFICIENT_OUTPUT_AMOUNT` 错误，说明：
   - `amount0Out` 设置过大（超过实际能换到的数量）
   - 池子储备量不足
   - 需要重新查询池子状态并计算正确的 `amount0Out`

