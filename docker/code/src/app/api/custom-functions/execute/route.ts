import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

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
    const receipt = await tx.wait();

    // 停止模拟账户
    await provider.send('anvil_stopImpersonatingAccount', [account_address]);

    return NextResponse.json({
      success: true,
      message: '函数执行成功',
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    });
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
