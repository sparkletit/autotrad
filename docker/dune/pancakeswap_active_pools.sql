-- 查询最近30天内活跃的 PancakeSwap 交易池的可疑转账
-- 筛选条件：
--   1. 在一笔交易（同一个 tx_hash）中，同一交易池向至少5个不同的 EOA 地址发送代币
--   2. 这些转账不是因为 Swap、Burn、Mint 等正常 DEX 操作发生的
--   3. 排除的代币：wbnb, usdt, usdc, dai
-- 适配 Dune v4：使用 erc20_bnb.evt_Transfer + pancakeswap_v2_bnb
-- 性能优化版本：使用 LEFT JOIN 代替 NOT IN；限制扫描范围；避免全表扫描

WITH 
-- 定义排除的代币地址（BSC 主网）
excluded_tokens AS (
    SELECT contract_address FROM (
        VALUES 
        (0xbb4cdb9cbd36b01bd1cbaeBf2de08d9173bc095c), -- WBNB
        (0x55d398326f99059ff775485246999027b3197955), -- USDT (BSC)
        (0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d), -- USDC (BSC)
        (0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3)  -- DAI (BSC)
    ) AS t(contract_address)
),

-- 定义 PancakeSwap Router 地址（用于排除）
known_routers AS (
    SELECT router_address FROM (
        VALUES 
        (0x10ED43C718714eb63d5aA57B78B54704E256024E),  -- PancakeSwap Router V2
        (0x13f4ea83d0bd40e75c8222255bc855a974568dd4)   -- PancakeSwap Router V3
    ) AS t(router_address)
),

-- 获取最近30天内活跃的 PancakeSwap V2 交易池
recent_active_pools AS (
    SELECT DISTINCT pair AS pool_address
    FROM pancakeswap_v2_bnb.PancakeFactory_evt_PairCreated
    WHERE evt_block_time >= NOW() - INTERVAL '90' DAY  -- 90天内创建的池子（范围适当放宽）
),

-- 获取已知的交易池地址（用于排除接收方是交易池的情况）
all_known_pools AS (
    SELECT DISTINCT pair AS pool_address
    FROM pancakeswap_v2_bnb.PancakeFactory_evt_PairCreated
    WHERE evt_block_time >= NOW() - INTERVAL '365' DAY
),

-- 获取近30天内包含 Swap 事件的交易 hash（需要排除这些交易）
recent_swaps AS (
    SELECT DISTINCT evt_tx_hash
    FROM pancakeswap_v2_bnb.PancakePair_evt_Swap
    WHERE evt_block_time >= NOW() - INTERVAL '30' DAY
),

-- 获取近30天内包含 Burn 事件的交易 hash（需要排除这些交易）
recent_burns AS (
    SELECT DISTINCT evt_tx_hash
    FROM pancakeswap_v2_bnb.PancakePair_evt_Burn
    WHERE evt_block_time >= NOW() - INTERVAL '30' DAY
),

-- 获取近30天内包含 Mint 事件的交易 hash（需要排除这些交易）
recent_mints AS (
    SELECT DISTINCT evt_tx_hash
    FROM pancakeswap_v2_bnb.PancakePair_evt_Mint
    WHERE evt_block_time >= NOW() - INTERVAL '30' DAY
),

-- 获取交易池向地址发送代币的转账记录（使用 LEFT JOIN 优化性能）
-- 排除已知的合约地址（路由器、其他池子、排除的代币）
-- 排除 LP token 本身的 Transfer 事件（这些通常是事件声明而非真实代币转移）
pool_token_transfers AS (
    SELECT 
        t.evt_tx_hash AS tx_hash,
        t.evt_block_time AS block_time,
        t.contract_address AS token_address,
        t."from" AS pool_address,
        t."to" AS recipient_address,
        t.value AS token_amount,
        tok.symbol AS token_symbol
    FROM erc20_bnb.evt_Transfer t
    INNER JOIN recent_active_pools p 
        ON t."from" = p.pool_address  -- from 为 LP 池地址
    LEFT JOIN excluded_tokens et1
        ON t.contract_address = et1.contract_address  -- 排除的代币
    LEFT JOIN excluded_tokens et2
        ON t."to" = et2.contract_address  -- 排除的接收地址（代币地址）
    LEFT JOIN known_routers kr
        ON t."to" = kr.router_address  -- 排除路由合约
    LEFT JOIN all_known_pools kp
        ON t."to" = kp.pool_address  -- 排除接收方是其他交易池
    LEFT JOIN all_known_pools lp_token_check
        ON t.contract_address = lp_token_check.pool_address  -- 检查是否是 LP token 本身的转账
    LEFT JOIN tokens.erc20 tok
        ON t.contract_address = tok.contract_address
        AND tok.blockchain = 'bnb'
    WHERE t.evt_block_time >= NOW() - INTERVAL '30' DAY
        AND t.value > 0
        AND et1.contract_address IS NULL  -- 代币不在排除列表
        AND et2.contract_address IS NULL  -- 接收地址不是排除的代币地址
        AND kr.router_address IS NULL  -- 接收地址不是路由合约
        AND kp.pool_address IS NULL  -- 接收地址不是其他交易池
        AND lp_token_check.pool_address IS NULL  -- 排除 LP token 本身的转账事件（contract_address 不是 LP token 地址）
        AND t.contract_address != t."from"  -- 额外确保：转账的代币地址不等于发送方地址（排除自引用）
),

-- 按交易 hash 和交易池地址分组，筛选出同一笔交易中同一交易池向多个不同 EOA 发送代币的情况
-- 排除虚假 Transfer 事件（所有金额完全相同的异常情况）
tx_pool_stats AS (
    SELECT 
        tx_hash,
        pool_address,
        MAX(block_time) AS block_time,  -- 同一笔交易的时间相同
        COUNT(DISTINCT recipient_address) AS recipient_count,  -- 同一笔交易中接收代币的不同 EOA 数量
        COUNT(DISTINCT token_address) AS unique_tokens,  -- 涉及的不同代币数量
        COUNT(DISTINCT token_amount) AS unique_amounts,  -- 不同的转账金额数量（用于检测异常）
        array_join(array_agg(DISTINCT COALESCE(token_symbol, 'UNKNOWN')), ', ') AS token_symbols,
        array_join(array_agg(DISTINCT recipient_address), ', ') AS recipient_addresses,
        SUM(token_amount) AS total_token_amount,
        MIN(token_amount) AS min_amount,
        MAX(token_amount) AS max_amount
    FROM pool_token_transfers
    WHERE token_symbol IS NOT NULL  -- 只保留有有效 symbol 的代币（排除未验证的代币）
    GROUP BY tx_hash, pool_address  -- 按交易 hash 和交易池地址分组
    HAVING COUNT(DISTINCT recipient_address) >= 5  -- 同一笔交易中，同一交易池向至少5个不同的 EOA 发送代币
        AND COUNT(DISTINCT token_amount) > 1  -- 转账金额必须有变化（排除所有金额完全相同的虚假事件）
),

-- 联表获取交易信息（只选择成功的交易，并排除包含 Swap/Burn/Mint 事件的交易）
tx_enriched AS (
    SELECT 
        tps.tx_hash,
        tps.block_time,
        tps.pool_address,
        tps.recipient_count,
        tps.unique_tokens,
        tps.unique_amounts,
        tps.token_symbols,
        tps.recipient_addresses,
        tps.total_token_amount,
        tps.min_amount,
        tps.max_amount,
        tx."from" AS tx_initiator,
        CONCAT('https://bscscan.com/tx/', CAST(tps.tx_hash AS VARCHAR)) AS bscscan_link
    FROM tx_pool_stats tps
    INNER JOIN bnb.transactions tx 
        ON tps.tx_hash = tx.hash
        AND tx.success = true  -- 只选择成功的交易
        AND tx.block_time >= NOW() - INTERVAL '30' DAY  -- 限制交易表的扫描范围
    LEFT JOIN recent_swaps rs
        ON tps.tx_hash = rs.evt_tx_hash  -- 检查是否包含 Swap 事件
    LEFT JOIN recent_burns rb
        ON tps.tx_hash = rb.evt_tx_hash  -- 检查是否包含 Burn 事件
    LEFT JOIN recent_mints rm
        ON tps.tx_hash = rm.evt_tx_hash  -- 检查是否包含 Mint 事件
    WHERE rs.evt_tx_hash IS NULL  -- 排除包含 Swap 事件的交易
        AND rb.evt_tx_hash IS NULL  -- 排除包含 Burn 事件的交易
        AND rm.evt_tx_hash IS NULL  -- 排除包含 Mint 事件的交易
),

-- 按 pool_address 去重，每个池子只保留最新的一条记录
ranked_results AS (
    SELECT 
        tx_hash,
        block_time,
        pool_address,
        recipient_count,
        unique_tokens,
        unique_amounts,
        token_symbols,
        recipient_addresses,
        total_token_amount,
        min_amount,
        max_amount,
        tx_initiator,
        bscscan_link,
        ROW_NUMBER() OVER (PARTITION BY pool_address ORDER BY block_time DESC, recipient_count DESC) AS rn
    FROM tx_enriched
)

-- 最终查询：每个 pool_address 只显示最新的一条记录，总共限制5万条
SELECT 
    tx_hash,
    block_time,
    pool_address,
    recipient_count,
    unique_tokens,
    unique_amounts,
    token_symbols,
    recipient_addresses,
    total_token_amount,
    min_amount,
    max_amount,
    tx_initiator,
    bscscan_link
FROM ranked_results
WHERE rn = 1  -- 每个 pool_address 只取最新的一条
ORDER BY block_time DESC, recipient_count DESC
LIMIT 50000
