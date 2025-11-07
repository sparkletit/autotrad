-- 添加 is_preset 字段到 custom_function_templates 表
ALTER TABLE custom_function_templates 
ADD COLUMN IF NOT EXISTS is_preset TINYINT(1) DEFAULT 0 COMMENT '是否为预制模板' AFTER description;

-- 添加索引
ALTER TABLE custom_function_templates 
ADD INDEX IF NOT EXISTS idx_is_preset (is_preset);

