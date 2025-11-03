-- 适配 Dune v4：使用 erc20_bnb.evt_Transfer + pancakeswap_v2_bnb 与 tokens.erc20
-- 优化：避免全表扫描 bnb.logs；去除字节截取函数；用 LEFT JOIN 代替 NOT EXISTS
-- 更新时间：2025-10-31

WITH recent_active_pools AS (
    -- 近365天在 PancakeSwap V2 创建的交易对，视为活跃 LP 池
    SELECT DISTINCT pair AS pool_address
    FROM pancakeswap_v2_bnb.PancakeFactory_evt_PairCreated
    WHERE evt_block_time >= NOW() - INTERVAL '365' DAY
),
known_routers AS (
    -- 常见路由合约地址（排除这些接收地址的转账）
    SELECT router_address FROM (
        VALUES 
        (0x10ED43C718714eb63d5aA57B78B54704E256024E),  -- PancakeSwap Router V2
        (0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F),  -- PancakeSwap Router V1
        (0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506)   -- Sushiswap Router
    ) AS t(router_address)
),
excluded_tokens AS (
    -- 排除主流代币：WBNB、USDT、USDC（BSC 主网地址）
    SELECT contract_address FROM (
        VALUES 
        (0xbb4cdb9cbd36b01bd1cbaeBf2de08d9173bc095c), -- WBNB
        (0x55d398326f99059ff775485246999027b3197955), -- USDT
        (0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d)  -- USDC
    ) AS t(contract_address)
),

filtered_events AS (
    SELECT 
        t.contract_address,
        CAST(t.evt_tx_hash AS VARCHAR) AS tx_hash,
        t.evt_block_time
    FROM erc20_bnb.evt_Transfer AS t
    INNER JOIN recent_active_pools p 
        ON t."from" = p.pool_address       -- from 为 LP 池地址
    LEFT JOIN known_routers kr 
        ON t."to" = kr.router_address      -- 排除路由合约接收
    WHERE 
        t.evt_block_time >= NOW() - INTERVAL '90' DAY
        AND kr.router_address IS NULL
        AND t.value > 0
        AND t.contract_address NOT IN (SELECT contract_address FROM excluded_tokens)
),

counts AS (
    SELECT 
        contract_address,
        COUNT(*) AS dividend_txs
    FROM filtered_events
    GROUP BY contract_address
    HAVING COUNT(*) >= 10 -- 至少10次 LP→用户 转账
),

distinct_tx AS (
    SELECT 
        contract_address AS token_address,
        tx_hash,
        max(evt_block_time) AS last_time
    FROM filtered_events
    GROUP BY contract_address, tx_hash
),

limited_tx AS (
    SELECT token_address, tx_hash
    FROM (
        SELECT 
            token_address,
            tx_hash,
            row_number() OVER (PARTITION BY token_address ORDER BY last_time DESC) AS rn
        FROM distinct_tx
    )
    WHERE rn <= 200
)

SELECT 
    c.contract_address AS token_address,
    c.dividend_txs,
    array_join(array_agg(lt.tx_hash), ',') AS tx_hashes
FROM counts c
LEFT JOIN limited_tx lt ON lt.token_address = c.contract_address
GROUP BY c.contract_address, c.dividend_txs
ORDER BY c.dividend_txs DESC
LIMIT 5000;
