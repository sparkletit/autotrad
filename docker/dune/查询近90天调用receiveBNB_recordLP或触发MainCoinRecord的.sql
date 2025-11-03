-- 近90天内调用指定方法或触发指定事件的所有交易哈希（不重复）
-- 参考本仓库其他Dune SQL的表名与写法（bnb.transactions / bnb.logs）
-- 方法选择器：
--   receiveBNB = 0x6515eaba
--   recordLP   = 0x2a35ba31
-- 事件主题：
--   MainCoinRecord = 0x8b2eea3c3ae37fd78a2b9f9109a941c3fe722631b876723ba337b56aa86eb26b
-- 更新时间：2025-11-01

WITH method_calls AS (
  SELECT 
    t.block_time,
    CAST(t.hash AS VARCHAR) AS tx_hash,
    t."from" AS initiator,
    t.to AS contract_address,
    t.value / 1e18 AS tx_value_bnb,
    t.gas_used,
    t.gas_price,
    (t.gas_used * t.gas_price) / 1e18 AS gas_cost_bnb,
    'method' AS source_type,
    CASE 
      WHEN bytearray_substring(t.data, 1, 4) = 0x6515eaba THEN 'receiveBNB'
      WHEN bytearray_substring(t.data, 1, 4) = 0x2a35ba31 THEN 'recordLP'
      ELSE 'unknown'
    END AS source_name,
    CASE 
      WHEN bytearray_substring(t.data, 1, 4) = 0x6515eaba THEN '0x6515eaba'
      WHEN bytearray_substring(t.data, 1, 4) = 0x2a35ba31 THEN '0x2a35ba31'
      ELSE NULL
    END AS identifier,
    CAST(NULL AS INT) AS log_index
  FROM bnb.transactions AS t
  WHERE 
    t.block_time >= NOW() - INTERVAL '90' DAY
    AND t.data IS NOT NULL
    AND bytearray_length(t.data) >= 4
    -- 直接按原生字节与常量比较（替换 IN 为 OR 以便布尔优化）
    AND (
      bytearray_substring(t.data, 1, 4) = 0x6515eaba  -- receiveBNB
      OR bytearray_substring(t.data, 1, 4) = 0x2a35ba31  -- recordLP
    )
    -- 预筛交易大小相关字段，帮助引擎选择更优的路径
    AND t.gas_used IS NOT NULL
    AND t.gas_price IS NOT NULL
),

event_emits AS (
  SELECT 
    l.block_time,
    CAST(l.tx_hash AS VARCHAR) AS tx_hash,
    tx."from" AS initiator,
    l.contract_address AS contract_address,
    tx.value / 1e18 AS tx_value_bnb,
    tx.gas_used,
    tx.gas_price,
    (tx.gas_used * tx.gas_price) / 1e18 AS gas_cost_bnb,
    'event' AS source_type,
    'MainCoinRecord' AS source_name,
    '0x8b2eea3c3ae37fd78a2b9f9109a941c3fe722631b876723ba337b56aa86eb26b' AS identifier,
    l.index AS log_index
  FROM bnb.logs AS l
  INNER JOIN bnb.transactions AS tx
    ON l.tx_hash = tx.hash
  WHERE 
    l.block_time >= NOW() - INTERVAL '90' DAY
    AND l.topic0 = 0x8b2eea3c3ae37fd78a2b9f9109a941c3fe722631b876723ba337b56aa86eb26b -- MainCoinRecord
),

unioned AS (
  SELECT 
    block_time, tx_hash, initiator, contract_address,
    tx_value_bnb, gas_used, gas_price, gas_cost_bnb,
    source_type, source_name, identifier, log_index
  FROM method_calls
  UNION ALL
  SELECT 
    block_time, tx_hash, initiator, contract_address,
    tx_value_bnb, gas_used, gas_price, gas_cost_bnb,
    source_type, source_name, identifier, log_index
  FROM event_emits
),

tx_ranked AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (
      PARTITION BY tx_hash
      ORDER BY gas_cost_bnb DESC, block_time DESC, COALESCE(log_index, 0) ASC
    ) AS rn_tx
  FROM unioned
),

sender_ranked AS (
  SELECT 
    initiator,
    tx_hash,
    contract_address,
    tx_value_bnb,
    gas_used,
    gas_price,
    gas_cost_bnb,
    source_type,
    source_name,
    identifier,
    log_index,
    block_time,
    ROW_NUMBER() OVER (
      PARTITION BY initiator 
      ORDER BY gas_cost_bnb DESC, block_time DESC, COALESCE(log_index, 0) ASC
    ) AS rn
  FROM tx_ranked
  WHERE rn_tx = 1
)

SELECT 
  block_time,
  tx_hash,
  initiator,
  contract_address,
  tx_value_bnb,
  gas_used,
  gas_price,
  gas_cost_bnb,
  source_type,
  source_name,
  identifier,
  log_index,
  CONCAT('https://bscscan.com/tx/', CAST(tx_hash AS VARCHAR)) AS bscscan_link
FROM (
  SELECT 
    sr.*,
    ROW_NUMBER() OVER (
      PARTITION BY sr.contract_address
      ORDER BY sr.gas_cost_bnb DESC, sr.block_time DESC
    ) AS rn_contract
  FROM sender_ranked sr
  WHERE sr.rn = 1
) dedup_contract
WHERE rn_contract = 1
ORDER BY gas_cost_bnb DESC, block_time DESC
LIMIT 50000;