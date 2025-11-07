import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET - 获取所有自定义函数模板
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const presetOnly = searchParams.get('preset_only') === 'true';
    const excludePreset = searchParams.get('exclude_preset') === 'true';
    
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
    
    let query = 'SELECT * FROM custom_function_templates';
    const params: any[] = [];
    
    if (hasIsPresetField) {
      if (presetOnly) {
        query += ' WHERE is_preset = 1';
      } else if (excludePreset) {
        query += ' WHERE is_preset = 0 OR is_preset IS NULL';
      }
      query += ' ORDER BY is_preset DESC, created_at DESC';
    } else {
      // 如果字段不存在，所有模板都视为历史模板
      if (presetOnly) {
        query += ' WHERE 1 = 0'; // 返回空结果
      } else {
        query += ' ORDER BY created_at DESC';
      }
    }
    
    const [rows] = await pool.query(query, params);
    
    // 如果字段不存在，为所有记录添加 is_preset = 0
    const result = (rows as any[]).map((row: any) => {
      if (!hasIsPresetField) {
        row.is_preset = 0;
      }
      return row;
    });
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取自定义函数模板失败:', error);
    return NextResponse.json(
      { success: false, error: '获取模板列表失败: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}

// POST - 创建新的自定义函数模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      account_address,
      contract_address,
      abi_content,
      function_name,
      params_json,
      description,
    } = body;

    // 验证必填字段
    if (!account_address || !contract_address || !abi_content || !function_name || !params_json) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段' },
        { status: 400 }
      );
    }

    // 检查是否已存在相同的模板
    const [existingRows] = await pool.query(
      `SELECT id FROM custom_function_templates 
       WHERE account_address = ? 
       AND contract_address = ? 
       AND function_name = ? 
       AND params_json = ?
       LIMIT 1`,
      [account_address, contract_address, function_name, params_json]
    );

    const existing = existingRows as any[];
    if (existing.length > 0) {
      // 已存在相同模板，更新updated_at时间
      await pool.query(
        `UPDATE custom_function_templates 
         SET updated_at = CURRENT_TIMESTAMP, description = ?
         WHERE id = ?`,
        [description || null, existing[0].id]
      );

      return NextResponse.json({
        success: true,
        message: '模板已存在，已更新时间',
        data: { id: existing[0].id, existed: true },
      });
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

    // 插入新模板（不允许用户创建预制模板）
    let insertQuery: string;
    let insertParams: any[];
    
    if (hasIsPresetField) {
      insertQuery = `INSERT INTO custom_function_templates 
       (account_address, contract_address, abi_content, function_name, params_json, description, is_preset) 
       VALUES (?, ?, ?, ?, ?, ?, 0)`;
      insertParams = [
        account_address,
        contract_address,
        abi_content,
        function_name,
        params_json,
        description || null,
      ];
    } else {
      insertQuery = `INSERT INTO custom_function_templates 
       (account_address, contract_address, abi_content, function_name, params_json, description) 
       VALUES (?, ?, ?, ?, ?, ?)`;
      insertParams = [
        account_address,
        contract_address,
        abi_content,
        function_name,
        params_json,
        description || null,
      ];
    }
    
    const [result] = await pool.query(insertQuery, insertParams);

    return NextResponse.json({
      success: true,
      message: '模板保存成功',
      data: { id: (result as any).insertId, existed: false },
    });
  } catch (error) {
    console.error('保存自定义函数模板失败:', error);
    return NextResponse.json(
      { success: false, error: '保存模板失败' },
      { status: 500 }
    );
  }
}

// DELETE - 删除模板
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少模板ID' },
        { status: 400 }
      );
    }

    // 允许删除所有模板（包括预制模板）
    await pool.query('DELETE FROM custom_function_templates WHERE id = ?', [id]);

    return NextResponse.json({
      success: true,
      message: '模板删除成功',
    });
  } catch (error) {
    console.error('删除模板失败:', error);
    return NextResponse.json(
      { success: false, error: '删除模板失败' },
      { status: 500 }
    );
  }
}
