-- Footprint Analytics 查询
-- 查询近30天内活跃的交易池中，单笔交易包含多次 Transfer 的交易
-- 筛选条件：
--   1. 在一笔交易（同一个 tx_hash）中，发生多次 Transfer 操作
--   2. 以 tx_hash 去重，确保每笔交易只显示一次
--   3. 时间范围可配置（默认30天）
--
-- 注意：Footprint 的表名可能与 Dune 不同，请根据实际情况调整
-- 参考文档：https://docs.footprint.network/

WITH 
-- 配置变量：时间范围（天数）
config AS (
    SELECT 
        30 AS days_lookback,  -- 先用1天测试性能
        3 AS min_transfer_count  -- 最小 Transfer 次数阈值
),

-- 定义排除的代币地址（BSC 主网）
excluded_tokens AS (
    SELECT address FROM (
        VALUES 
        ('0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'), -- WBNB
        ('0x55d398326f99059ff775485246999027b3197955'), -- USDT (BSC)
        ('0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'), -- USDC (BSC)
        ('0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3')  -- DAI (BSC)
    ) AS t(address)
),

-- 获取近期活跃的 DEX 交易池
-- 使用 Footprint 的 dex_trades 表找到活跃池子
active_pools AS (
    SELECT DISTINCT 
        pool_address
    FROM dex_trades
    CROSS JOIN config
    WHERE chain = 'bsc'  -- ⚠️ 多链表必须过滤 chain
        AND block_timestamp >= CURRENT_DATE - INTERVAL '1' DAY * (SELECT days_lookback FROM config)
),

-- 获取涉及活跃池子的 ERC20 转账事件
-- 使用 Footprint 的 bsc_token_transfers 表
pool_related_transfers AS (
    SELECT 
        t.transaction_hash AS tx_hash,
        t.block_timestamp,
        t.block_number,
        t.token_address,
        t.from_address,
        t.to_address,
        t.amount_raw AS token_amount,
        CAST(t.token_address AS VARCHAR) AS token_symbol,  -- 暂时用地址代替symbol以提升性能
        CASE 
            WHEN ap_from.pool_address IS NOT NULL THEN ap_from.pool_address
            WHEN ap_to.pool_address IS NOT NULL THEN ap_to.pool_address
            ELSE NULL
        END AS related_pool
    FROM bsc_token_transfers t
    CROSS JOIN config
    LEFT JOIN active_pools ap_from
        ON t.from_address = ap_from.pool_address
    LEFT JOIN active_pools ap_to
        ON t.to_address = ap_to.pool_address
    LEFT JOIN excluded_tokens et
        ON LOWER(t.token_address) = LOWER(et.address)
    WHERE t.block_timestamp >= CURRENT_DATE - INTERVAL '1' DAY * (SELECT days_lookback FROM config)
        AND t.amount_raw > 0
        AND (ap_from.pool_address IS NOT NULL OR ap_to.pool_address IS NOT NULL)
        AND et.address IS NULL  -- 排除主流稳定币
),

-- 统计每笔交易中的 Transfer 次数和相关信息
tx_transfer_stats AS (
    SELECT 
        tx_hash,
        MAX(block_timestamp) AS block_time,
        MAX(block_number) AS block_number,
        COUNT(*) AS transfer_count,
        COUNT(DISTINCT related_pool) AS pool_count,
        COUNT(DISTINCT token_address) AS unique_tokens,
        COUNT(DISTINCT from_address) AS unique_from_addresses,
        COUNT(DISTINCT to_address) AS unique_to_addresses,
        MAX(related_pool) AS pool_addresses,  -- 简化：只取一个池子地址
        MAX(token_symbol) AS token_symbols,  -- 简化：只取一个代币地址
        SUM(token_amount) AS total_transfer_amount
    FROM pool_related_transfers
    GROUP BY tx_hash
    HAVING COUNT(*) >= (SELECT min_transfer_count FROM config)
),

-- 获取交易的详细信息
-- 使用 Footprint 的 bsc_transactions 表
tx_enriched AS (
    SELECT 
        tts.tx_hash,
        tts.block_time,
        tts.block_number,
        tts.transfer_count,
        tts.pool_count,
        tts.unique_tokens,
        tts.unique_from_addresses,
        tts.unique_to_addresses,
        tts.pool_addresses,
        tts.token_symbols,
        tts.total_transfer_amount,
        tx.from_address AS tx_initiator,
        tx.to_address AS tx_target,
        tx.value AS tx_value,
        tx.gas AS gas_used,
        tx.gas_price,
        CONCAT('https://bscscan.com/tx/', tts.tx_hash) AS bscscan_link
    FROM tx_transfer_stats tts
    LEFT JOIN bsc_transactions tx
        ON tts.tx_hash = tx.hash
    WHERE tx.receipt_status = 1  -- 只选择成功的交易
)

-- 最终查询：显示所有符合条件的交易（以 tx_hash 去重）
SELECT 
    te.tx_hash,
    te.block_time,
    te.block_number,
    te.transfer_count,
    te.pool_count,
    te.unique_tokens,
    te.unique_from_addresses,
    te.unique_to_addresses,
    te.pool_addresses,
    te.token_symbols,
    te.total_transfer_amount,
    te.tx_initiator,
    te.tx_target,
    CAST(te.tx_value AS DECIMAL(38, 18)) / 1e18 AS tx_value_bnb,
    te.gas_used,
    CAST(te.gas_price AS DECIMAL(38, 18)) / 1e9 AS gas_price_gwei,
    te.bscscan_link
FROM tx_enriched te
ORDER BY te.block_time DESC, te.transfer_count DESC
LIMIT 50

-- 使用说明：
-- 1. Footprint 实际表名（已验证）：
--    代币转账: bsc_token_transfers
--    交易记录: bsc_transactions
--    代币信息: token_info
--    DEX 池子: dex_pool_info
--    DEX 交易: dex_trades
-- 2. 时间范围可在第13行修改 days_lookback
-- 3. Transfer 次数阈值可在第14行修改 min_transfer_count
-- 4. 建议先用 7 天测试，确认无误后再增加到 30 天

