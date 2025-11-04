-- Footprint Analytics 快速测试查询
-- 用于验证连接和熟悉基本语法

-- 测试 1: 查看最近的 ERC20 转账（最基础）
-- ✅ 使用实际的表名: bsc_token_transfers
SELECT 
    transaction_hash,
    block_timestamp,
    from_address,
    to_address,
    token_address,
    amount_raw
FROM bsc_token_transfers
WHERE block_timestamp >= CURRENT_DATE - INTERVAL '1' DAY
LIMIT 10;


-- 测试 2: 查看最近的交易
-- ✅ 使用实际的表名: bsc_transactions
/*
SELECT 
    hash AS transaction_hash,
    block_number,
    block_timestamp,
    from_address,
    to_address,
    value,
    gas AS gas_used,
    receipt_status
FROM bsc_transactions
WHERE block_timestamp >= CURRENT_DATE - INTERVAL '1' DAY
    AND receipt_status = 1  -- 成功的交易
LIMIT 10;
*/


-- 测试 3: 查看 DEX 池子信息
-- ✅ 使用实际的表名: dex_pool_info
/*
SELECT 
    pool_address,
    protocol_slug,
    token0_address,
    token1_address,
    created_time
FROM dex_pool_info
WHERE chain = 'bsc'  -- 指定 BSC 链
LIMIT 10;
*/


-- 测试 4: 统计最近一小时的转账次数（测试聚合功能）
-- ✅ 使用实际的表名: bsc_token_transfers
/*
SELECT 
    COUNT(*) AS transfer_count,
    COUNT(DISTINCT transaction_hash) AS unique_tx_count,
    COUNT(DISTINCT from_address) AS unique_senders,
    COUNT(DISTINCT to_address) AS unique_receivers
FROM bsc_token_transfers
WHERE block_timestamp >= CURRENT_TIMESTAMP - INTERVAL '1' HOUR;
*/

-- 测试 5: 查看代币信息
-- ✅ 使用实际的表名: token_info
/*
SELECT 
    token_address,
    symbol,
    name,
    decimals
FROM token_info
WHERE chain = 'bsc'  -- 指定 BSC 链
    AND symbol IN ('WBNB', 'USDT', 'USDC', 'BUSD')
LIMIT 10;
*/


-- 使用说明：
-- 1. 先运行测试 1，如果成功说明基本配置正确
-- 2. 如果报错，检查错误信息中的提示，调整表名
-- 3. 逐个取消注释其他测试查询，验证不同功能
-- 4. 在 Schema Explorer 中查看实际可用的表和字段

