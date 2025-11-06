import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import pool from '@/lib/db';

/**
 * POST /api/fork/save-state
 * 保存 Anvil Fork 网络的当前状态到 JSON 文件，并保存 fork 参数到数据库
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stateName, rpcUrl, blockNumber, chainId, chainKey } = body;

    if (!stateName) {
      return NextResponse.json(
        { success: false, error: '请提供状态名称' },
        { status: 400 }
      );
    }

    // Fork 参数是可选的（如果没有提供，只保存状态文件，不保存到数据库）
    // 优先通过 rpcUrl 从数据库查找 chainKey 和 chainId（最准确的方法）
    let finalChainKey = chainKey;
    let finalChainId = chainId;
    let finalRpcUrl = rpcUrl;
    
    // 如果有 rpcUrl，从数据库查找对应的 chain_key 和 chain_id
    if (rpcUrl) {
      try {
        const connection = await pool.getConnection();
        try {
          // 通过 rpcUrl 查找对应的 chain_key 和 chain_id
          const [rows] = await connection.query(
            'SELECT chain_key, chain_id, rpc_url FROM rpc_nodes WHERE rpc_url = ? AND is_active = 1 LIMIT 1',
            [rpcUrl]
          );
          if (rows && (rows as any[]).length > 0) {
            const nodeInfo = (rows as any[])[0];
            if (!finalChainKey) {
              finalChainKey = nodeInfo.chain_key;
              console.log(`通过 rpcUrl 查找到 chainKey: ${finalChainKey}`);
            }
            if (!finalChainId && nodeInfo.chain_id !== undefined) {
              finalChainId = nodeInfo.chain_id;
              console.log(`通过 rpcUrl 查找到 chainId: ${finalChainId}`);
            }
            // 使用数据库中的 rpc_url（可能更规范）
            finalRpcUrl = nodeInfo.rpc_url;
          } else {
            console.warn(`⚠️ 在数据库中未找到 rpcUrl 对应的记录: ${rpcUrl}`);
          }
        } finally {
          connection.release();
        }
      } catch (err) {
        console.warn('通过 rpcUrl 查找 chainKey/chainId 失败:', err);
      }
    }
    
    // 如果仍然缺少 chainKey，但有 chainId，尝试通过 chainId 查找
    if (!finalChainKey && finalChainId !== undefined) {
      try {
        const connection = await pool.getConnection();
        try {
          const [rows] = await connection.query(
            'SELECT chain_key FROM rpc_nodes WHERE chain_id = ? AND is_active = 1 LIMIT 1',
            [finalChainId]
          );
          if (rows && (rows as any[]).length > 0) {
            finalChainKey = (rows as any[])[0].chain_key;
            console.log(`通过 chainId ${finalChainId} 查找到 chainKey: ${finalChainKey}`);
          }
        } finally {
          connection.release();
        }
      } catch (err) {
        console.warn('通过 chainId 查找 chainKey 失败:', err);
      }
    }
    
    // 检查是否有足够的参数保存到数据库
    const hasForkParams = finalRpcUrl && blockNumber !== undefined && finalChainId !== undefined;

    // 验证状态名称（只允许字母、数字、下划线、中划线）
    if (!/^[a-zA-Z0-9_-]+$/.test(stateName)) {
      return NextResponse.json(
        { success: false, error: '状态名称只能包含字母、数字、下划线和中划线' },
        { status: 400 }
      );
    }

    console.log(`正在保存网络状态: ${stateName}`);

    // 调用 Anvil 的 anvil_dumpState RPC 方法
    const anvilRpcUrl = process.env.ANVIL_RPC_URL || 'http://anvil-api:8545';
    const response = await fetch(anvilRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'anvil_dumpState',
        params: [],
        id: 1,
      }),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(`获取状态失败: ${result.error.message}`);
    }

    if (!result.result) {
      throw new Error('未能获取网络状态数据');
    }

    // 保存到文件（使用挂载的共享目录）
    const statesDir = process.env.ANVIL_STATES_DIR || join(process.cwd(), 'anvil-states');
    
    // 确保目录存在
    try {
      await mkdir(statesDir, { recursive: true });
    } catch (err) {
      // 目录可能已存在，忽略错误
    }

    const fileName = `${stateName}.json`;
    const filePath = join(statesDir, fileName);
    
    // 将状态数据写入文件（格式化 JSON）
    await writeFile(filePath, JSON.stringify(result.result, null, 2), 'utf-8');

    console.log(`✅ 状态已保存到: ${filePath}`);

    // 如果提供了 fork 参数，保存到数据库
    if (hasForkParams) {
      const connection = await pool.getConnection();
      try {
        await connection.query(
          `INSERT INTO fork_states (state_name, rpc_url, block_number, chain_id, chain_key, file_name) 
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           rpc_url = VALUES(rpc_url),
           block_number = VALUES(block_number),
           chain_id = VALUES(chain_id),
           chain_key = VALUES(chain_key),
           file_name = VALUES(file_name),
           updated_at = CURRENT_TIMESTAMP`,
          [stateName, finalRpcUrl, blockNumber, finalChainId, finalChainKey || null, fileName]
        );
        
        console.log(`✅ Fork 参数已保存到数据库`);
      } finally {
        connection.release();
      }
    } else {
      console.warn(`⚠️ 未提供 fork 参数，只保存状态文件`);
    }

    return NextResponse.json({
      success: true,
      message: `网络状态已保存为 "${stateName}"${hasForkParams ? '（含 fork 参数）' : '（仅状态文件）'}`,
      fileName,
      filePath,
      forkConfig: hasForkParams ? {
        rpcUrl: finalRpcUrl,
        blockNumber,
        chainId: finalChainId,
        chainKey: finalChainKey || null,
      } : null,
    });
  } catch (error) {
    console.error('保存网络状态失败:', error);
    const errorMessage = error instanceof Error ? error.message : '保存失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fork/save-state
 * 获取已保存的状态列表（包含 fork 参数）
 */
export async function GET() {
  try {
    const { readdir, stat } = await import('fs/promises');
    
    // 从数据库获取 fork 参数
    const connection = await pool.getConnection();
    let dbStates: any[] = [];
    try {
      const [rows] = await connection.query(
        'SELECT state_name, rpc_url, block_number, chain_id, chain_key, file_name, created_at, updated_at FROM fork_states ORDER BY updated_at DESC'
      );
      dbStates = rows as any[];
    } finally {
      connection.release();
    }

    // 创建状态名称到 fork 配置的映射
    const stateConfigMap = new Map();
    dbStates.forEach((state: any) => {
      stateConfigMap.set(state.state_name, {
        rpcUrl: state.rpc_url,
        blockNumber: state.block_number,
        chainId: state.chain_id,
        chainKey: state.chain_key,
      });
    });

    // 使用挂载的共享目录
    const statesDir = process.env.ANVIL_STATES_DIR || join(process.cwd(), 'anvil-states');
    try {
      const files = await readdir(statesDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      // 获取文件详情并合并 fork 配置
      const states = await Promise.all(
        jsonFiles.map(async (file) => {
          const filePath = join(statesDir, file);
          const stats = await stat(filePath);
          const stateName = file.replace('.json', '');
          const forkConfig = stateConfigMap.get(stateName);
          
          return {
            name: stateName,
            fileName: file,
            size: stats.size,
            createdAt: stats.birthtime.toISOString(),
            modifiedAt: stats.mtime.toISOString(),
            forkConfig: forkConfig || null, // fork 参数（如果数据库中有）
          };
        })
      );

      return NextResponse.json({
        success: true,
        states: states.sort((a, b) => 
          new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
        ),
      });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // 目录不存在，返回空列表
        return NextResponse.json({
          success: true,
          states: [],
        });
      }
      throw err;
    }
  } catch (error) {
    console.error('获取状态列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取状态列表失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fork/save-state
 * 删除保存的状态（文件和数据库记录）
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stateName = searchParams.get('stateName');

    if (!stateName) {
      return NextResponse.json(
        { success: false, error: '请提供状态名称' },
        { status: 400 }
      );
    }

    console.log(`正在删除状态: ${stateName}`);

    const statesDir = process.env.ANVIL_STATES_DIR || join(process.cwd(), 'anvil-states');
    const filePath = join(statesDir, `${stateName}.json`);

    // 删除文件
    try {
      await unlink(filePath);
      console.log(`✅ 已删除文件: ${filePath}`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      console.warn(`⚠️ 文件不存在: ${filePath}`);
    }

    // 从数据库删除记录
    const connection = await pool.getConnection();
    try {
      await connection.query(
        'DELETE FROM fork_states WHERE state_name = ?',
        [stateName]
      );
      console.log(`✅ 已从数据库删除状态: ${stateName}`);
    } finally {
      connection.release();
    }

    return NextResponse.json({
      success: true,
      message: `状态 "${stateName}" 已删除`,
    });
  } catch (error) {
    console.error('删除状态失败:', error);
    const errorMessage = error instanceof Error ? error.message : '删除失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

