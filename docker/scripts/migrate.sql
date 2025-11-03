-- 迁移脚本：更新 custom_tokens 表结构

-- 检查是否存在旧表并进行迁移
ALTER TABLE custom_tokens 
MODIFY COLUMN symbol VARCHAR(20) NOT NULL COMMENT '代币符号';

-- 重命名 address 列为 contract_address
ALTER TABLE custom_tokens 
CHANGE COLUMN address contract_address VARCHAR(42) NOT NULL COMMENT '合约地址';

-- 添加 network 列（如果不存在）
ALTER TABLE custom_tokens 
ADD COLUMN IF NOT EXISTS network VARCHAR(50) DEFAULT 'all' COMMENT '网络' AFTER decimals;

-- 添加 is_active 列（如果不存在）
ALTER TABLE custom_tokens 
ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1 COMMENT '是否活跃' AFTER name;

-- 添加 updated_at 列（如果不存在）
ALTER TABLE custom_tokens 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- 删除旧的唯一索引
DROP INDEX IF EXISTS unique_address ON custom_tokens;

-- 添加新的唯一索引
ALTER TABLE custom_tokens 
ADD UNIQUE KEY unique_contract_address (contract_address);

-- 添加 is_active 索引
ALTER TABLE custom_tokens 
ADD INDEX IF NOT EXISTS idx_is_active (is_active);
