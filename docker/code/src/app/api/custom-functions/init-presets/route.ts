import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST - 初始化预制模板
export async function POST(request: NextRequest) {
  try {
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
        { success: false, error: '数据库表缺少 is_preset 字段，请先执行迁移脚本: add_preset_templates.sql' },
        { status: 400 }
      );
    }
    
    // 删除旧的预制模板
    await pool.query('DELETE FROM custom_function_templates WHERE is_preset = 1');

    // PancakeSwap V2 Router ABI (简化版，只包含常用函数)
    const pancakeV2RouterABI = JSON.stringify([
      {
        type: 'function',
        name: 'swapExactTokensForTokens',
        inputs: [
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMin', type: 'uint256' },
          { name: 'path', type: 'address[]' },
          { name: 'to', type: 'address' },
          { name: 'deadline', type: 'uint256' }
        ],
        outputs: [{ name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable'
      },
      {
        type: 'function',
        name: 'addLiquidity',
        inputs: [
          { name: 'tokenA', type: 'address' },
          { name: 'tokenB', type: 'address' },
          { name: 'amountADesired', type: 'uint256' },
          { name: 'amountBDesired', type: 'uint256' },
          { name: 'amountAMin', type: 'uint256' },
          { name: 'amountBMin', type: 'uint256' },
          { name: 'to', type: 'address' },
          { name: 'deadline', type: 'uint256' }
        ],
        outputs: [
          { name: 'amountA', type: 'uint256' },
          { name: 'amountB', type: 'uint256' },
          { name: 'liquidity', type: 'uint256' }
        ],
        stateMutability: 'nonpayable'
      },
      {
        type: 'function',
        name: 'removeLiquidity',
        inputs: [
          { name: 'tokenA', type: 'address' },
          { name: 'tokenB', type: 'address' },
          { name: 'liquidity', type: 'uint256' },
          { name: 'amountAMin', type: 'uint256' },
          { name: 'amountBMin', type: 'uint256' },
          { name: 'to', type: 'address' },
          { name: 'deadline', type: 'uint256' }
        ],
        outputs: [
          { name: 'amountA', type: 'uint256' },
          { name: 'amountB', type: 'uint256' }
        ],
        stateMutability: 'nonpayable'
      }
    ]);

    // PancakeSwap V3 Router ABI (简化版)
    const pancakeV3RouterABI = JSON.stringify([
      {
        type: 'function',
        name: 'exactInputSingle',
        inputs: [
          {
            name: 'params',
            type: 'tuple',
            components: [
              { name: 'tokenIn', type: 'address' },
              { name: 'tokenOut', type: 'address' },
              { name: 'fee', type: 'uint24' },
              { name: 'recipient', type: 'address' },
              { name: 'deadline', type: 'uint256' },
              { name: 'amountIn', type: 'uint256' },
              { name: 'amountOutMinimum', type: 'uint256' },
              { name: 'sqrtPriceLimitX96', type: 'uint160' }
            ]
          }
        ],
        outputs: [{ name: 'amountOut', type: 'uint256' }],
        stateMutability: 'payable'
      },
      {
        type: 'function',
        name: 'multicall',
        inputs: [{ name: 'data', type: 'bytes[]' }],
        outputs: [{ name: 'results', type: 'bytes[]' }],
        stateMutability: 'payable'
      }
    ]);

    const presetTemplates = [
      // PancakeSwap V2
      {
        account_address: '0x0000000000000000000000000000000000000000',
        contract_address: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        abi_content: pancakeV2RouterABI,
        function_name: 'swapExactTokensForTokens',
        params_json: JSON.stringify({
          amountIn: '0',
          amountOutMin: '0',
          path: ['0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000'],
          to: '0x0000000000000000000000000000000000000000',
          deadline: '0'
        }),
        description: 'PancakeSwap V2 - 交换代币',
        is_preset: 1
      },
      {
        account_address: '0x0000000000000000000000000000000000000000',
        contract_address: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        abi_content: pancakeV2RouterABI,
        function_name: 'addLiquidity',
        params_json: JSON.stringify({
          tokenA: '0x0000000000000000000000000000000000000000',
          tokenB: '0x0000000000000000000000000000000000000000',
          amountADesired: '0',
          amountBDesired: '0',
          amountAMin: '0',
          amountBMin: '0',
          to: '0x0000000000000000000000000000000000000000',
          deadline: '0'
        }),
        description: 'PancakeSwap V2 - 添加流动性',
        is_preset: 1
      },
      {
        account_address: '0x0000000000000000000000000000000000000000',
        contract_address: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        abi_content: pancakeV2RouterABI,
        function_name: 'removeLiquidity',
        params_json: JSON.stringify({
          tokenA: '0x0000000000000000000000000000000000000000',
          tokenB: '0x0000000000000000000000000000000000000000',
          liquidity: '0',
          amountAMin: '0',
          amountBMin: '0',
          to: '0x0000000000000000000000000000000000000000',
          deadline: '0'
        }),
        description: 'PancakeSwap V2 - 移除流动性',
        is_preset: 1
      },
      // PancakeSwap V3
      {
        account_address: '0x0000000000000000000000000000000000000000',
        contract_address: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
        abi_content: pancakeV3RouterABI,
        function_name: 'exactInputSingle',
        params_json: JSON.stringify({
          params: {
            tokenIn: '0x0000000000000000000000000000000000000000',
            tokenOut: '0x0000000000000000000000000000000000000000',
            fee: '3000',
            recipient: '0x0000000000000000000000000000000000000000',
            deadline: '0',
            amountIn: '0',
            amountOutMinimum: '0',
            sqrtPriceLimitX96: '0'
          }
        }),
        description: 'PancakeSwap V3 - 交换代币（单路径）',
        is_preset: 1
      },
      {
        account_address: '0x0000000000000000000000000000000000000000',
        contract_address: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
        abi_content: pancakeV3RouterABI,
        function_name: 'multicall',
        params_json: JSON.stringify({
          data: ['0x']
        }),
        description: 'PancakeSwap V3 - 添加流动性（使用multicall）',
        is_preset: 1
      },
      {
        account_address: '0x0000000000000000000000000000000000000000',
        contract_address: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
        abi_content: pancakeV3RouterABI,
        function_name: 'multicall',
        params_json: JSON.stringify({
          data: ['0x']
        }),
        description: 'PancakeSwap V3 - 移除流动性（使用multicall）',
        is_preset: 1
      }
    ];

    // 批量插入
    for (const template of presetTemplates) {
      await pool.query(
        `INSERT INTO custom_function_templates 
         (account_address, contract_address, abi_content, function_name, params_json, description, is_preset) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          template.account_address,
          template.contract_address,
          template.abi_content,
          template.function_name,
          template.params_json,
          template.description,
          template.is_preset
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: `成功初始化 ${presetTemplates.length} 个预制模板`,
      data: { count: presetTemplates.length }
    });
  } catch (error) {
    console.error('初始化预制模板失败:', error);
    return NextResponse.json(
      { success: false, error: '初始化预制模板失败' },
      { status: 500 }
    );
  }
}

