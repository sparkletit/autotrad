-- 完整的颜色默认值迁移脚本
-- 用于将所有代币颜色默认值设置为'无'（空字符串）

-- 1. 更新表结构，将颜色字段默认值改为空字符串
ALTER TABLE imported_tokens 
ALTER COLUMN color SET DEFAULT '';

-- 2. 更新现有记录的蓝色默认值为空字符串（无）
UPDATE imported_tokens 
SET color = '' 
WHERE color = 'blue' OR color IS NULL;

-- 3. 验证更新结果
SELECT 
  color,
  COUNT(*) as count,
  CASE 
    WHEN color = '' THEN '无'
    WHEN color = 'red' THEN '红色'
    WHEN color = 'yellow' THEN '黄色'
    WHEN color = 'blue' THEN '蓝色'
    WHEN color = 'green' THEN '绿色'
    WHEN color = 'purple' THEN '紫色'
    ELSE '其他'
  END as color_name
FROM imported_tokens 
GROUP BY color 
ORDER BY count DESC;

-- 4. 检查是否有任何NULL值需要处理
SELECT COUNT(*) as null_color_count 
FROM imported_tokens 
WHERE color IS NULL;

-- 如果有NULL值，执行以下更新
-- UPDATE imported_tokens SET color = '' WHERE color IS NULL;