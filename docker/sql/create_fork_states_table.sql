-- 创建 fork_states 表来存储每个保存状态的 fork 参数
CREATE TABLE IF NOT EXISTS fork_states (
  id INT PRIMARY KEY AUTO_INCREMENT,
  state_name VARCHAR(100) UNIQUE NOT NULL COMMENT '状态名称（唯一）',
  rpc_url VARCHAR(500) NOT NULL COMMENT 'Fork 时使用的 RPC URL',
  block_number BIGINT NOT NULL COMMENT 'Fork 的区块号',
  chain_id INT NOT NULL COMMENT '链 ID',
  chain_key VARCHAR(50) NOT NULL COMMENT '链的 key（如 bsc, eth）',
  file_name VARCHAR(150) NOT NULL COMMENT '状态文件名',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_state_name (state_name),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Fork 网络状态配置表';

