-- BSC链上近30天所有成功的闪电贷交易查询
-- 支持协议: PancakeSwap V3, AAVE V3, DODO, Uniswap V3
-- 查询时间: 最近30天
-- 
-- 闪电贷事件签名说明:
-- 0xefefaba5e921573100900a3ad9cf29f222d995fb3b6045797eaea7521bd8d6f0 = Aave V3 FlashLoan事件
-- 0xc76f1b4fe4396ac07a9fa55a415d4ca430e72651d37d3401f3bed7cb13fc4f12 = PancakeSwap V3 FlashLoan事件
-- 0x0d7d75e01ab95780d3cd1c8ec0dd6c2ce19e3a20427eec8bf53283b6fb8e95f0 = Uniswap V3 Flash事件
-- 0xa9ba3ffe0b6c366b81232caab38605a0699ad5398d6cce76f91ee809e322dafc = DODO DODOFlashLoan事件

WITH flashloan_logs AS (
  SELECT 
    logs.block_time,
    logs.block_number,
    logs.tx_hash,
    logs.contract_address,
    logs.topic0,
    logs.topic1,
    logs.topic2,
    logs.topic3,
    logs.data,
    logs.index AS log_index,
    CASE 
      WHEN logs.topic0 = 0xefefaba5e921573100900a3ad9cf29f222d995fb3b6045797eaea7521bd8d6f0 THEN 'Aave V3'
      WHEN logs.topic0 = 0xc76f1b4fe4396ac07a9fa55a415d4ca430e72651d37d3401f3bed7cb13fc4f12 THEN 'PancakeSwap V3'
      WHEN logs.topic0 = 0x0d7d75e01ab95780d3cd1c8ec0dd6c2ce19e3a20427eec8bf53283b6fb8e95f0 THEN 'Uniswap V3'
      WHEN logs.topic0 = 0xa9ba3ffe0b6c366b81232caab38605a0699ad5398d6cce76f91ee809e322dafc THEN 'DODO'
      ELSE 'Unknown'
    END AS protocol
  FROM bnb.logs AS logs
  WHERE 
    logs.block_time >= NOW() - INTERVAL '30' day
    AND logs.topic0 IN (
      0xefefaba5e921573100900a3ad9cf29f222d995fb3b6045797eaea7521bd8d6f0, -- Aave V3
      0xc76f1b4fe4396ac07a9fa55a415d4ca430e72651d37d3401f3bed7cb13fc4f12, -- PancakeSwap V3
      0x0d7d75e01ab95780d3cd1c8ec0dd6c2ce19e3a20427eec8bf53283b6fb8e95f0, -- Uniswap V3
      0xa9ba3ffe0b6c366b81232caab38605a0699ad5398d6cce76f91ee809e322dafc  -- DODO
    )
),

transaction_status AS (
  SELECT 
    hash AS tx_hash,
    "from" AS tx_from,
    to AS tx_to,
    value,
    gas_used,
    gas_price,
    success
  FROM bnb.transactions
  WHERE 
    block_time >= NOW() - INTERVAL '90' day
    AND success = true  -- 只选择成功的交易
),

ranked AS (
  SELECT 
    fl.block_time,
    fl.block_number,
    fl.tx_hash,
    fl.protocol,
    fl.contract_address AS flashloan_contract,
    ts.tx_from AS initiator,
    ts.tx_to AS target_contract,
    ts.value / 1e18 AS tx_value_bnb,
    ts.gas_used,
    ts.gas_price,
    (ts.gas_used * ts.gas_price) / 1e18 AS gas_cost_bnb,
    fl.log_index,
    -- BSCScan链接
    CONCAT('https://bscscan.com/tx/', CAST(fl.tx_hash AS VARCHAR)) AS bscscan_link,
    row_number() OVER (PARTITION BY fl.tx_hash ORDER BY fl.log_index ASC) AS rn
  FROM flashloan_logs fl
  INNER JOIN transaction_status ts ON fl.tx_hash = ts.tx_hash
)

SELECT 
  block_time,
  block_number,
  tx_hash,
  protocol,
  flashloan_contract,
  initiator,
  target_contract,
  tx_value_bnb,
  gas_used,
  gas_price,
  gas_cost_bnb,
  log_index,
  bscscan_link
FROM ranked
WHERE rn = 1
ORDER BY block_time DESC
LIMIT 50000