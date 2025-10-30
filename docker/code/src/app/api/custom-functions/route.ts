import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET - 获取所有自定义函数模板
export async function GET() {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM custom_function_templates ORDER BY created_at DESC'
    );
    
    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error('获取自定义函数模板失败:', error);
    return NextResponse.json(
      { success: false, error: '获取模板列表失败' },
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

    // 插入新模板
    const [result] = await pool.query(
      `INSERT INTO custom_function_templates 
       (account_address, contract_address, abi_content, function_name, params_json, description) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        account_address,
        contract_address,
        abi_content,
        function_name,
        params_json,
        description || null,
      ]
    );

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
