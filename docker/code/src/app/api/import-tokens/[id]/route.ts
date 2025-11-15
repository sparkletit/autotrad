import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// 更新代币信息
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const body = await request.json();
    const { color, notes, pool: poolValue } = body;
    
    console.log('收到更新请求:', { id, color, notes, pool: poolValue });
    
    if (color === undefined && notes === undefined && poolValue === undefined) {
      return NextResponse.json(
        { 
          success: false, 
          error: '缺少更新参数' 
        },
        { status: 400 }
      );
    }
    
    const updates: string[] = [];
    const values: any[] = [];

    if (poolValue !== undefined) {
      try {
        const [colRows] = await pool.execute(
          "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'imported_tokens' AND COLUMN_NAME = 'pool'"
        );
        const exists = Array.isArray(colRows) && (colRows as any[]).length > 0;
        if (!exists) {
          await pool.execute("ALTER TABLE imported_tokens ADD COLUMN pool INT DEFAULT 0 COMMENT '交易池数量'");
        }
      } catch (e) {}
    }
    
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }
    
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (poolValue !== undefined) {
      const poolVal = typeof poolValue === 'number' ? poolValue : Number(String(poolValue));
      const safePool = Number.isFinite(poolVal) && poolVal >= 0 ? poolVal : 0;
      updates.push('pool = ?');
      values.push(safePool);
    }
    
    values.push(id);
    
    const query = `UPDATE imported_tokens SET ${updates.join(', ')} WHERE id = ?`;
    
    console.log('执行SQL查询:', query, values);
    
    const [result] = await pool.execute(query, values);
    
    console.log('更新结果:', result);
    
    return NextResponse.json({ 
      success: true, 
      message: '更新成功' 
    });
  } catch (error) {
    console.error('更新代币信息失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '更新失败',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 删除代币
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    
    const [result] = await pool.execute(
      'DELETE FROM imported_tokens WHERE id = ?',
      [id]
    );
    
    return NextResponse.json({ 
      success: true, 
      message: '删除成功' 
    });
  } catch (error) {
    console.error('删除代币失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '删除失败' 
      },
      { status: 500 }
    );
  }
}