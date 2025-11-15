-- 创建代币余额表
CREATE TABLE IF NOT EXISTS token_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  token_address VARCHAR(42) NOT NULL,
  token_symbol VARCHAR(50) NOT NULL,
  token_name VARCHAR(200),
  chain VARCHAR(20) NOT NULL,
  balance_wei VARCHAR(78) NOT NULL, -- 使用字符串存储大数字
  balance_eth DECIMAL(30,18) NOT NULL, -- 以太币单位的余额
  usd_value DECIMAL(20,8) DEFAULT 0, -- USD价值
  decimals INT DEFAULT 18,
  logo_url TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_wallet_token_chain (wallet_address, token_address, chain),
  KEY idx_wallet_address (wallet_address),
  KEY idx_token_address (token_address),
  KEY idx_chain (chain),
  KEY idx_updated_at (updated_at)
);

-- 创建余额汇总表
CREATE TABLE IF NOT EXISTS wallet_balance_summary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL UNIQUE KEY,
  total_usd_value DECIMAL(20,8) DEFAULT 0,
  token_count INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_wallet_address (wallet_address),
  KEY idx_total_usd_value (total_usd_value),
  KEY idx_last_updated (last_updated)
);

-- 添加表注释
ALTER TABLE token_balances COMMENT = '存储钱包代币余额信息';
ALTER TABLE wallet_balance_summary COMMENT = '存储钱包余额汇总信息';