-- 查看 bsc_token_transfers 表的实际字段
SELECT *
FROM bsc_token_transfers
WHERE block_timestamp >= CURRENT_DATE - INTERVAL '1' DAY
LIMIT 1;

