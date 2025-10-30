import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// 辅助函数：将对象中的 BigInt 转换为字符串
function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(item => convertBigIntToString(item));
    }
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = convertBigIntToString(obj[key]);
      }
    }
    return result;
  }
  return obj;
}

// POST - 执行自定义函数
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      account_address,
      contract_address,
      abi_content,
      function_name,
      params,
      gas_limit,
      value, // ETH/BNB value to send with transaction
    } = body;

    // 验证必填字段
    if (!account_address || !contract_address || !abi_content || !function_name) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段' },
        { status: 400 }
      );
    }

    // 解析ABI
    let abiArray;
    try {
      abiArray = typeof abi_content === 'string' ? JSON.parse(abi_content) : abi_content;
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'ABI格式错误' },
        { status: 400 }
      );
    }

    // 连接到Fork网络
    const provider = new ethers.JsonRpcProvider('http://host.docker.internal:8545');
    
    // 模拟账户（在Anvil中）
    await provider.send('anvil_impersonateAccount', [account_address]);
    await provider.send('hardhat_setBalance', [account_address, '0x56BC75E2D63100000']); // 100 ETH
    
    const signer = await provider.getSigner(account_address);
    
    // 创建合约实例
    const contract = new ethers.Contract(contract_address, abiArray, signer);

    // 准备交易参数
    const paramsArray = Array.isArray(params) ? params : [];
    
    // 构建交易选项
    const txOptions: any = {};
    if (gas_limit && gas_limit !== 'auto') {
      txOptions.gasLimit = BigInt(gas_limit);
    }
    if (value) {
      txOptions.value = ethers.parseEther(value.toString());
    }

    // 如果gas_limit是auto，则预估gas
    if (gas_limit === 'auto') {
      try {
        const estimatedGas = await contract[function_name].estimateGas(...paramsArray, txOptions);
        txOptions.gasLimit = (estimatedGas * 120n) / 100n; // 增加20%缓冲
      } catch (e) {
        console.error('Gas预估失败:', e);
        // 使用默认值
        txOptions.gasLimit = BigInt(3000000);
      }
    }

    // 执行合约函数
    const tx = await contract[function_name](...paramsArray, txOptions);
    
    // 等待交易完成并获取交易回执
    // 检查tx是否是一个交易对象（有wait方法）
    let receipt;
    if (tx && typeof tx.wait === 'function') {
      // 这是一个交易对象，需要等待
      receipt = await tx.wait();
    } else if (tx && typeof tx === 'object' && tx.hash) {
      // 这是一个交易哈希对象
      receipt = tx;
    } else {
      // 这可能是一个只读函数的返回值，或者交易直接返回结果
      console.log('函数返回值:', tx);
      const safeResult = convertBigIntToString(tx);
      return NextResponse.json({
        success: true,
        message: '函数执行成功',
        result: safeResult,
      });
    }

    if (!receipt) {
      throw new Error('无法获取交易回执');
    }

    // 检查交易是否成功（只针对状态修改函数）
    // receipt.status: 0x1 或 1 表示成功，0x0 或 0 表示失败
    if (receipt.status !== undefined) {
      const status = typeof receipt.status === 'string' ? parseInt(receipt.status, 16) : receipt.status;
      if (status === 0) {
        throw new Error('交易执行失败：合约调用被 revert');
      }
    }

    // 停止模拟账户
    await provider.send('anvil_stopImpersonatingAccount', [account_address]);

    // 构造响应
    const response: any = {
      success: true,
      message: '函数执行成功',
      txHash: receipt.hash || tx.hash,
      blockNumber: receipt.blockNumber?.toString() || '0',
      gasUsed: receipt.gasUsed?.toString() || '0',
    };

    // 尝试获取返回值（尽管是无返回值函数）
    // 对于有返回值的函数，我们已经成功获取了（在else分支返回）
    // 对于无返回值函数，设置result为”0x”(空布新)，表示执行成功但无返回值
    response.result = '0x'; // 无返回值

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('执行自定义函数失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || '函数执行失败',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
