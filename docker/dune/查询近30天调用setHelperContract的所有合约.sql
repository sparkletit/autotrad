-- 近30天调用 setHelperContract (selector 0xc5639cc6) 的合约
-- 输出：contract_address, tx_hash, block_time；按合约地址去重（保留最新一条）

WITH method_calls AS (
  SELECT
    t.block_time,
    t.to AS contract_address,
    t.hash AS tx_hash
  FROM bnb.transactions t
  WHERE
    t.block_time >= NOW() - INTERVAL '30' DAY
    AND bytearray_length(t.data) >= 4
    AND bytearray_substring(t.data, 1, 4) = 0xc5639cc6
    AND t.gas_used IS NOT NULL
    AND t.gas_price IS NOT NULL
),
dedup_contract AS (
  SELECT
    contract_address,
    tx_hash,
    block_time,
    ROW_NUMBER() OVER (
      PARTITION BY contract_address 
      ORDER BY block_time DESC
    ) AS rn_contract
  FROM method_calls
)
SELECT
  contract_address,
  tx_hash,
  block_time
FROM dedup_contract
WHERE rn_contract = 1
ORDER BY block_time DESC
LIMIT 50000;