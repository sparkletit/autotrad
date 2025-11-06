import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * POST /api/fork/load-state
 * 通过 RPC 将保存的状态加载到正在运行的 Anvil 实例
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stateName } = body;

    if (!stateName) {
      return NextResponse.json(
        { success: false, error: '请提供状态名称' },
        { status: 400 }
      );
    }

    console.log(`正在加载网络状态: ${stateName}`);

    // 读取状态文件（使用挂载的共享目录）
    const statesDir = process.env.ANVIL_STATES_DIR || join(process.cwd(), 'anvil-states');
    const filePath = join(statesDir, `${stateName}.json`);
    
    let stateData: string;
    try {
      const fileContent = await readFile(filePath, 'utf-8');
      // 文件内容是一个被引号包裹的 hex 字符串，去掉引号
      stateData = fileContent.trim().replace(/^"|"$/g, '');
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return NextResponse.json(
          { success: false, error: `状态文件不存在: ${stateName}` },
          { status: 404 }
        );
      }
      throw err;
    }

    // 调用 Anvil 的 anvil_loadState RPC 方法
    const rpcUrl = process.env.ANVIL_RPC_URL || 'http://anvil-api:8545';
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'anvil_loadState',
        params: [stateData], // 传入 hex 字符串
        id: 1,
      }),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(`加载状态失败: ${result.error.message}`);
    }

    console.log(`✅ 状态 "${stateName}" 已成功加载`);

    return NextResponse.json({
      success: true,
      message: `网络状态 "${stateName}" 已成功加载`,
    });
  } catch (error) {
    console.error('加载网络状态失败:', error);
    const errorMessage = error instanceof Error ? error.message : '加载失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

