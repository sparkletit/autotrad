import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST - 执行数据库迁移，添加 is_preset 字段
export async function POST(request: NextRequest) {
  try {
    // 检查 is_preset 字段是否已存在
    const [columns] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'custom_function_templates' 
       AND COLUMN_NAME = 'is_preset'`
    );
    
    const hasIsPresetField = (columns as any[]).length > 0;
    
    if (hasIsPresetField) {
      return NextResponse.json({
        success: true,
        message: 'is_preset 字段已存在，无需迁移',
        data: { migrated: false }
      });
    }
    
    // 添加 is_preset 字段
    await pool.query(
      `ALTER TABLE custom_function_templates 
       ADD COLUMN is_preset TINYINT(1) DEFAULT 0 COMMENT '是否为预制模板' AFTER description`
    );
    
    // 添加索引
    try {
      await pool.query(
        `ALTER TABLE custom_function_templates 
         ADD INDEX idx_is_preset (is_preset)`
      );
    } catch (e) {
      // 索引可能已存在，忽略错误
      console.warn('添加索引失败（可能已存在）:', e);
    }
    
    return NextResponse.json({
      success: true,
      message: '数据库迁移成功，已添加 is_preset 字段',
      data: { migrated: true }
    });
  } catch (error) {
    console.error('数据库迁移失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '数据库迁移失败: ' + (error instanceof Error ? error.message : String(error)) 
      },
      { status: 500 }
    );
  }
}

