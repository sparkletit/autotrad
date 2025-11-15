import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// 批量删除代币
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '缺少必要参数' 
        },
        { status: 400 }
      );
    }
    
    // 验证所有ID都是数字
    const validIds = ids.filter(id => typeof id === 'number' && id > 0);
    
    if (validIds.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '没有有效的ID' 
        },
        { status: 400 }
      );
    }
    
    // 构建IN查询
    const placeholders = validIds.map(() => '?').join(',');
    const query = `DELETE FROM imported_tokens WHERE id IN (${placeholders})`;
    
    const [result] = await pool.execute(query, validIds);
    
    return NextResponse.json({ 
      success: true, 
      message: `成功删除 ${validIds.length} 个代币地址` 
    });
  } catch (error) {
    console.error('批量删除代币失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '批量删除失败' 
      },
      { status: 500 }
    );
  }
}