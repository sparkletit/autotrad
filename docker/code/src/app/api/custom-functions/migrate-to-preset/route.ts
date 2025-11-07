import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST - 将历史模板迁移到预制模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: '缺少模板ID' },
        { status: 400 }
      );
    }

    // 检查 is_preset 字段是否存在
    let hasIsPresetField = false;
    try {
      const [columns] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'custom_function_templates' 
         AND COLUMN_NAME = 'is_preset'`
      );
      hasIsPresetField = (columns as any[]).length > 0;
    } catch (e) {
      console.warn('检查 is_preset 字段失败:', e);
    }

    if (!hasIsPresetField) {
      return NextResponse.json(
        { success: false, error: '数据库表缺少 is_preset 字段，请先执行迁移' },
        { status: 400 }
      );
    }

    // 获取要迁移的模板
    const [templateRows] = await pool.query(
      'SELECT * FROM custom_function_templates WHERE id = ?',
      [templateId]
    );

    const templates = templateRows as any[];
    if (templates.length === 0) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      );
    }

    const template = templates[0];

    // 如果已经是预制模板，直接返回
    if (template.is_preset === 1) {
      return NextResponse.json({
        success: true,
        message: '模板已经是预制模板',
        data: { id: template.id, updated: false }
      });
    }

    // 检查是否已存在相同的预制模板（相同的合约地址和函数名，排除自己）
    const [existingRows] = await pool.query(
      `SELECT id FROM custom_function_templates 
       WHERE contract_address = ? 
       AND function_name = ? 
       AND is_preset = 1
       AND id != ?
       LIMIT 1`,
      [template.contract_address, template.function_name, templateId]
    );

    const existing = existingRows as any[];
    
    if (existing.length > 0) {
      // 已存在，更新参数和描述
      await pool.query(
        `UPDATE custom_function_templates 
         SET params_json = ?, 
             description = ?,
             abi_content = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          template.params_json,
          template.description || null,
          template.abi_content,
          existing[0].id
        ]
      );

      // 删除原历史模板
      await pool.query('DELETE FROM custom_function_templates WHERE id = ?', [templateId]);

      return NextResponse.json({
        success: true,
        message: '模板已迁移到预制模板，并更新了参数',
        data: { id: existing[0].id, updated: true }
      });
    } else {
      // 不存在，将历史模板标记为预制模板
      await pool.query(
        `UPDATE custom_function_templates 
         SET is_preset = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [templateId]
      );

      return NextResponse.json({
        success: true,
        message: '模板已迁移到预制模板',
        data: { id: templateId, updated: false }
      });
    }
  } catch (error) {
    console.error('迁移模板到预制模板失败:', error);
    return NextResponse.json(
      { success: false, error: '迁移失败: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}

