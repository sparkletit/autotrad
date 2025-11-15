-- 为钱包余额汇总表添加tokens列用于存储JSON格式的代币详情
ALTER TABLE wallet_balance_summary 
ADD COLUMN tokens JSON DEFAULT NULL COMMENT 'JSON格式的代币余额详情';

-- 更新表注释
ALTER TABLE wallet_balance_summary COMMENT = '存储钱包余额汇总信息，包含JSON格式的代币详情';