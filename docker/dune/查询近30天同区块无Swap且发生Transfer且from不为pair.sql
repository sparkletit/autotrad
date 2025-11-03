-- 近30天：在同一区块内没有 PancakeSwap V2 的 Swap 事件，且发生了 ERC20 Transfer，且 from 不为任一 LP pair 的交易
-- 结果按合约地址去重（保留最新一条），显示 contract_address, tx_hash, block_time
-- 注：pair 集合来自 PancakeSwap V2 的 PairCreated；如需涵盖其它 DEX（V3/Uniswap/Sushi等）可扩展

WITH recent_active_pools AS (
  -- 近365天创建的 Pancake V2 交易对，视为活跃 LP pool
  SELECT DISTINCT pair AS pool_address
  FROM pancakeswap_v2_bnb.PancakeFactory_evt_PairCreated
  WHERE evt_block_time >= NOW() - INTERVAL '30' DAY
),

excluded_tokens AS (
  -- 排除主流代币（BSC）：WBNB、USDT、USDC、DAI（使用 varbinary 常量地址）
  SELECT contract_address FROM (
    VALUES 
      (0xbb4cdb9cbd36b01bd1cbaeBf2de08d9173bc095c), -- WBNB
      (0x55d398326f99059ff775485246999027b3197955), -- USDT
      (0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d), -- USDC
      (0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3)  -- DAI
  ) AS t(contract_address)
),

transfers AS (
  -- 近30天的 ERC20 Transfer 事件
  SELECT 
    t.contract_address,
    t.evt_tx_hash AS tx_hash,
    t.evt_block_time AS block_time,
    t."from" AS from_address,
    t."to"   AS to_address,
    t.value,
    t.evt_index AS log_index
  FROM erc20_bnb.evt_Transfer t
  WHERE 
    t.evt_block_time >= NOW() - INTERVAL '30' DAY
    AND t.value > 0
    AND t."from" != 0x0000000000000000000000000000000000000000
    AND t."to"   != 0x0000000000000000000000000000000000000000
    AND EXISTS (
      SELECT 1 FROM recent_active_pools p
      WHERE p.pool_address = t."from"
    )
    AND NOT EXISTS (
      SELECT 1 FROM excluded_tokens e
      WHERE e.contract_address = t.contract_address
    )
),

filtered AS (
  -- 过滤条件：同交易中 Transfer 之前无 Swap；排除 Mint/Burn（已在 transfers 中前置了 pair/主流币过滤）
  SELECT 
    tr.contract_address,
    tr.tx_hash,
    tr.block_time,
    tr.from_address
  FROM transfers tr
  WHERE 
    NOT EXISTS (
      SELECT 1
      FROM pancakeswap_v2_bnb.PancakePair_evt_Swap s
      WHERE s.evt_tx_hash = tr.tx_hash
        AND s.evt_index    < tr.log_index
        AND s.contract_address = tr.from_address
        AND s.evt_block_time >= NOW() - INTERVAL '30' DAY
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pancakeswap_v2_bnb.PancakePair_evt_Mint m
      WHERE m.evt_tx_hash = tr.tx_hash
        AND m.contract_address = tr.from_address
        AND m.evt_block_time >= NOW() - INTERVAL '30' DAY
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pancakeswap_v2_bnb.PancakePair_evt_Burn b
      WHERE b.evt_tx_hash = tr.tx_hash
        AND b.contract_address = tr.from_address
        AND b.evt_block_time >= NOW() - INTERVAL '30' DAY
    )
),

tx_enriched AS (
  -- 联到交易表，仅保留成功交易，并计算 gas 成本（BNB）
  SELECT 
    f.contract_address,
    f.tx_hash,
    f.block_time,
    (tx.gas_used * tx.gas_price) / 1e18 AS gas_cost_bnb
  FROM filtered f
  INNER JOIN bnb.transactions tx ON tx.hash = f.tx_hash
  WHERE tx.success = true
    AND tx.gas_used IS NOT NULL
    AND tx.gas_price IS NOT NULL
),

dedup AS (
  -- 按合约地址去重，保留 gas 成本最高的一条（次序按时间）
  SELECT 
    contract_address,
    tx_hash,
    block_time,
    gas_cost_bnb,
    ROW_NUMBER() OVER (
      PARTITION BY contract_address 
      ORDER BY gas_cost_bnb DESC, block_time DESC
    ) AS rn
  FROM tx_enriched
)

SELECT 
  contract_address,
  tx_hash,
  block_time
FROM dedup
WHERE rn = 1
ORDER BY gas_cost_bnb DESC, block_time DESC
LIMIT 50000;