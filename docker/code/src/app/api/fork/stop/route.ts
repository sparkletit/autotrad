import { NextRequest, NextResponse } from 'next/server';

/**
 * DELETE /api/fork/stop
 * 生成Anvil停止命令供用户在宿主机手动执行
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log('生成停止Anvil命令');

    // 生成停止命令
    const stopCommand = 'pkill -f "anvil --fork-url"';

    return NextResponse.json({
      success: true,
      message: 'Anvil Fork网络已停止',
      command: stopCommand,
    });
  } catch (error) {
    console.error('生成停止命令失败:', error);
    return NextResponse.json(
      { success: false, error: '停止Anvil失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fork/stop
 * 停止Anvil Fork网络（备用方法）
 */
export async function POST(request: NextRequest) {
  return DELETE(request);
}