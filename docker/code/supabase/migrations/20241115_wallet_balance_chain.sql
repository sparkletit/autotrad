-- 为钱包余额汇总表添加chain列
ALTER TABLE wallet_balance_summary 
ADD COLUMN chain VARCHAR(20) NOT NULL DEFAULT 'bsc' COMMENT '区块链网络' AFTER wallet_address,
DROP INDEX unique_wallet_address,
ADD UNIQUE KEY unique_wallet_chain (wallet_address, chain);