-- 更新导入代币表的颜色字段默认值
ALTER TABLE imported_tokens 
ALTER COLUMN color SET DEFAULT '';

-- 更新现有记录的蓝色默认值为空字符串（无）
UPDATE imported_tokens 
SET color = '' 
WHERE color = 'blue';

-- 验证更新
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
    ELSE color
  END as color_name
FROM imported_tokens 
GROUP BY color 
ORDER BY count DESC;