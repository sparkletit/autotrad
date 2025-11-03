-- 查询近30天内PancakeSwap V2交易对中没有经过正常Swap的可疑转账
-- 目标：发现从LP池直接转出但未经过swap/burn的异常代币转移
-- 优化版本：使用JOIN代替IN子查询，提升性能
-- 更新时间：2025-10-29

-- 步骤1: 获取PancakeSwap V2近90天活跃的交易对地址（缩小范围）
WITH recent_active_pools AS (
    SELECT DISTINCT pair AS pool_address
    FROM pancakeswap_v2_bnb.PancakeFactory_evt_PairCreated
    WHERE evt_block_time >= NOW() - INTERVAL '90' DAY
),

-- 已知的路由合约地址
known_routers AS (
    SELECT router_address FROM (
        VALUES 
        (0x10ED43C718714eb63d5aA57B78B54704E256024E),  -- PancakeSwap Router V2
        (0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F),  -- PancakeSwap Router V1
        (0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506)   -- Sushiswap Router
    ) AS t(router_address)
),

-- 近30天的Swap交易哈希集合
recent_swaps AS (
    SELECT DISTINCT evt_tx_hash
    FROM pancakeswap_v2_bnb.PancakePair_evt_Swap
    WHERE evt_block_time >= NOW() - INTERVAL '30' DAY
),

-- 近30天的Burn交易哈希集合
recent_burns AS (
    SELECT DISTINCT evt_tx_hash
    FROM pancakeswap_v2_bnb.PancakePair_evt_Burn
    WHERE evt_block_time >= NOW() - INTERVAL '30' DAY
),

-- 步骤2: 获取近30天从LP池转出的Transfer事件(使用JOIN优化)
suspect_transfers AS (
    SELECT
        logs.tx_hash AS evt_tx_hash,
        logs.contract_address AS token_address,
        bytearray_substring(logs.topic1, 13, 20) AS from_address,
        bytearray_substring(logs.topic2, 13, 20) AS to_address,
        bytearray_to_uint256(bytearray_substring(logs.data, 1, 32)) AS amount_transferred,
        logs.block_time AS transfer_time,
        logs.block_number AS block_number,
        logs.index AS log_index
    FROM bnb.logs
    INNER JOIN recent_active_pools p ON bytearray_substring(logs.topic1, 13, 20) = p.pool_address
    WHERE 
        logs.block_time >= NOW() - INTERVAL '30' DAY
        AND logs.topic0 = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
        -- 排除转给路由合约的交易(使用LEFT JOIN排除)
        AND NOT EXISTS (
            SELECT 1 FROM known_routers kr 
            WHERE bytearray_substring(logs.topic2, 13, 20) = kr.router_address
        )
),

-- 步骤3: 过滤掉正常Swap和Burn交易（使用LEFT JOIN反连接）
filtered_transfers AS (
    SELECT st.*
    FROM suspect_transfers st
    LEFT JOIN recent_swaps rs ON st.evt_tx_hash = rs.evt_tx_hash
    LEFT JOIN recent_burns rb ON st.evt_tx_hash = rb.evt_tx_hash
    WHERE rs.evt_tx_hash IS NULL  -- 不存在于Swap中
      AND rb.evt_tx_hash IS NULL  -- 不存在于Burn中
      AND st.amount_transferred > 0
),

-- 步骤4: 标记同区块内是否有DEX卖出行为
marked_transfers AS (
    SELECT 
        ft.*,
        CASE 
            WHEN EXISTS (
                SELECT 1 
                FROM pancakeswap_v2_bnb.PancakePair_evt_Swap s
                WHERE s.evt_block_number = ft.block_number
                AND s.evt_block_time >= NOW() - INTERVAL '30' DAY
                AND (s.sender = ft.to_address OR s."to" = ft.to_address)
            ) THEN 1
            ELSE 0
        END AS is_same_block_swap
    FROM filtered_transfers ft
    LIMIT 1000  -- 限制中间结果数量
),

-- 最终结果:按tx_hash去重,每笔交易只显示金额最大的那条转账
ranked_transfers AS (
    SELECT 
        mt.evt_tx_hash AS tx_hash,
        mt.from_address AS pool_address,
        mt.to_address AS suspicious_address,
        tok.symbol AS token_symbol,
        mt.amount_transferred / POWER(10, COALESCE(tok.decimals, 18)) AS normalized_amount,
        mt.transfer_time,
        mt.is_same_block_swap,
        t.value / 1e18 AS bnb_value_sent,
        CONCAT('0x', to_hex(bytearray_substring(t.data, 1, 4))) AS function_sig,
        t."from" AS tx_initiator,
        CONCAT('https://bscscan.com/tx/', CAST(mt.evt_tx_hash AS VARCHAR)) AS bscscan_link,
        ROW_NUMBER() OVER (PARTITION BY mt.evt_tx_hash ORDER BY mt.amount_transferred DESC) AS rn
    FROM marked_transfers mt
    LEFT JOIN bnb.transactions t ON mt.evt_tx_hash = t.hash AND t.block_time >= NOW() - INTERVAL '30' DAY
    LEFT JOIN tokens.erc20 tok ON mt.token_address = tok.contract_address AND tok.blockchain = 'bnb'
)

SELECT 
    tx_hash,
    pool_address,
    suspicious_address,
    token_symbol,
    normalized_amount,
    transfer_time,
    is_same_block_swap,
    bnb_value_sent,
    function_sig,
    tx_initiator,
    bscscan_link
FROM ranked_transfers
WHERE rn = 1  -- 每个tx_hash只取金额最大的一条
ORDER BY normalized_amount DESC
LIMIT 200;
