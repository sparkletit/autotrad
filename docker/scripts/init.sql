-- 创建自定义函数模板表
CREATE TABLE IF NOT EXISTS custom_function_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_address VARCHAR(42) NOT NULL COMMENT '发送交易的账户地址',
  contract_address VARCHAR(42) NOT NULL COMMENT '合约地址',
  abi_content TEXT NOT NULL COMMENT 'ABI内容(JSON格式)',
  function_name VARCHAR(100) NOT NULL COMMENT '函数名称',
  params_json TEXT NOT NULL COMMENT '执行参数(JSON格式)',
  description VARCHAR(255) DEFAULT NULL COMMENT '模板描述',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_account (account_address),
  INDEX idx_contract (contract_address),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='自定义函数执行模板表';

-- 创建自定义代币表（如果不存在）
CREATE TABLE IF NOT EXISTS custom_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL COMMENT '代币符号',
  address VARCHAR(42) NOT NULL COMMENT '合约地址',
  decimals INT DEFAULT 18 COMMENT '小数位数',
  name VARCHAR(100) DEFAULT NULL COMMENT '代币名称',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_address (address),
  INDEX idx_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='自定义代币表';
