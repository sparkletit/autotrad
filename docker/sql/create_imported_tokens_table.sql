-- 创建导入代币表
CREATE TABLE IF NOT EXISTS imported_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chain VARCHAR(20) NOT NULL COMMENT '区块链网络 (bsc, eth, polygon, arbitrum, optimism)',
  address VARCHAR(42) NOT NULL COMMENT '代币合约地址',
  color VARCHAR(20) DEFAULT '' COMMENT '颜色标记 (red, yellow, blue, green, purple, 空字符串表示无)',
  notes TEXT COMMENT '备注信息',
  pool INT DEFAULT 0 COMMENT '交易池数量',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_chain_address (chain, address),
  INDEX idx_chain (chain),
  INDEX idx_address (address),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='导入的代币地址表';