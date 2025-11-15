-- 创建交易池缓存表
CREATE TABLE token_pools_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token_id INT NOT NULL,
    chain VARCHAR(50) NOT NULL,
    token_address VARCHAR(255) NOT NULL,
    pools_data JSON NOT NULL,
    pool_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    INDEX idx_token_chain (token_id, chain),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (token_id) REFERENCES import_tokens(id) ON DELETE CASCADE
);

-- 添加备注
ALTER TABLE token_pools_cache 
ADD COLUMN analysis_metadata JSON AFTER pools_data;

-- 创建清理过期缓存的事件（如果数据库支持）
-- 注意：这需要事件调度器开启
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_expired_pools_cache
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
    DELETE FROM token_pools_cache WHERE expires_at < NOW();
END//
DELIMITER ;