import { NextRequest } from 'next/server';
import { ethers } from 'ethers';
import { getPrivateKeyFromDatabase, parseBlockchainError, ok, fail, getRpcUrl } from '@/lib/serverUtils';

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
      return fail('缺少必填字段', 400);
    }

    // 解析ABI
    let abiArray;
    try {
      abiArray = typeof abi_content === 'string' ? JSON.parse(abi_content) : abi_content;
    } catch (e) {
      return fail('ABI格式错误', 400);
    }

    console.log('========== 执行自定义函数 ==========');
    console.log('账户:', account_address);
    console.log('合约:', contract_address);
    console.log('函数:', function_name);
    
    // 1. 从数据库获取私钥（支持 main_accounts, derived_accounts, imported_accounts）
    const privateKey = await getPrivateKeyFromDatabase(account_address);
    if (!privateKey) {
      console.error('❌ 无法获取私钥');
      return fail(`账户 ${account_address} 的私钥不存在，请确保该账户已导入`, 400);
    }
    
    // 2. 连接到 Fork 网络（配置无超时限制）
    const rpcUrl = getRpcUrl('fork');
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      staticNetwork: true, // 使用静态网络，避免额外的网络检测请求
      batchMaxCount: 1,    // 禁用批量请求
    });
    
    // 验证账户是否存在且有效
    try {
      const balance = await provider.getBalance(account_address);
      console.log(`账户 ${account_address} 的余额: ${balance.toString()}`);
    } catch (e) {
      return fail(`无效的账户地址: ${account_address}`, 400);
    }
    
    // 3. 创建签名器
    const signer = new ethers.Wallet(privateKey, provider);
    console.log('✅ 成功创建 signer:', signer.address);
    
    // 创建合约实例
    const contract = new ethers.Contract(contract_address, abiArray, signer);

    // 找到目标函数的ABI
    const functionAbi = abiArray.find(
      (item: any) => item.type === 'function' && item.name === function_name
    );

    // 准备交易参数并进行类型转换
    let paramsArray = Array.isArray(params) ? params : [];
    if (functionAbi && functionAbi.inputs) {
      paramsArray = paramsArray.map((param: any, index: number) => {
        if (index < functionAbi.inputs.length) {
          const inputType = functionAbi.inputs[index].type;
          const convertedValue = convertParamByType(param, inputType);
          console.log(`参新${index}: ${functionAbi.inputs[index].name}(${inputType}) = ${param} -> ${convertedValue}`);
          return convertedValue;
        }
        return param;
      });
    }
    console.log('转换后的参数数组:', paramsArray);
    console.log('参数类型:', paramsArray.map((p: any) => typeof p));
    
    // ... existing code ...

    // 辅助函数：根据参数类型转换参数值
    function convertParamByType(value: any, paramType: string): any {
      if (value === null || value === undefined || value === '') {
        return value;
      }

      const typeStr = paramType.trim().toLowerCase();

      // 处理地址类型 - 转小写
      if (typeStr === 'address') {
        if (typeof value === 'string') {
          return value.toLowerCase();
        }
        return value;
      }

      // 处理整数类型 (uint, int, uint8, int256, 等)
      // 关键：对于小数输入，使用 parseEther 转换，但直接返回 BigInt
      // ethers.Contract 可以正确处理 BigInt 参数
      if (typeStr.startsWith('uint') || typeStr.startsWith('int')) {
        if (typeof value === 'string' || typeof value === 'number') {
          const strValue = value.toString().trim();
          // 处理小数：如果是小数，用 parseEther 转换为 Wei
          if (strValue.includes('.')) {
            try {
              const parsed = ethers.parseEther(strValue);
              return parsed; // 返回 BigInt，ethers.Contract 会正确处理
            } catch (e) {
              console.warn(`无法将 ${strValue} 转换为 ether，返回原值`);
              return strValue;
            }
          }
          // 处理整数：直接返回字符串让 ethers 转换
          return strValue;
        }
        return value;
      }

      // 处理布尔类型
      if (typeStr === 'bool') {
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);
      }

      // 处理字符串类型
      if (typeStr === 'string') {
        return value.toString();
      }

      // 处理字节类型
      if (typeStr.startsWith('bytes')) {
        if (typeof value === 'string' && !value.startsWith('0x')) {
          return '0x' + value;
        }
        return value;
      }

      // 处理数组类型
      if (typeStr.endsWith('[]')) {
        if (typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            return value;
          }
        }
        if (Array.isArray(value)) {
          const baseType = typeStr.slice(0, -2);
          return value.map(v => convertParamByType(v, baseType));
        }
        return value;
      }

      // 其他类型返回原值
      return value;
    }

    // ... existing code ...
    
    // 检查函数是否是只读函数（view 或 pure）
    const isReadOnly = functionAbi && (
      functionAbi.stateMutability === 'view' || 
      functionAbi.stateMutability === 'pure'
    );
    
    // 构建交易选项（只读函数不需要交易选项）
    const txOptions: any = {};
    if (!isReadOnly) {
      if (gas_limit && gas_limit !== 'auto') {
        txOptions.gasLimit = BigInt(gas_limit);
      }
      if (value) {
        txOptions.value = ethers.parseEther(value.toString());
      }

      // 如果gas_limit是auto，则预估gas（只读函数不需要）
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
    }

    // 执行合约函数
    console.log('执行合约函数:', function_name);
    console.log('函数类型:', isReadOnly ? '只读(view/pure)' : '状态修改');
    console.log('参数:', paramsArray);
    if (!isReadOnly) {
      console.log('交易选项:', txOptions);
    }
    
    // 只读函数不传递 txOptions；在只读场景下捕获回退并返回 400
    let tx: any;
    if (isReadOnly) {
      try {
        tx = await contract[function_name](...paramsArray);
      } catch (err: any) {
        const friendlyErrorMessage = parseBlockchainError(err);
        const lowerMsg = String(err?.message || err).toLowerCase();
        const isParamIssue = lowerMsg.includes('revert') || lowerMsg.includes('execution reverted');
        return fail(friendlyErrorMessage, isParamIssue ? 400 : 500, { details: err?.message || String(err) });
      }
    } else {
      tx = await contract[function_name](...paramsArray, txOptions);
    }
    
    // 等待交易完成并获取交易回执
    // 检查tx是否是一个交易对象（有wait方法）
    let receipt;
    if (tx && typeof tx.wait === 'function') {
      // 这是一个交易对象，需要等待
      console.log('✅ 交易已发送, 哈希:', tx.hash);
      console.log('⏳ 等待交易确认（无超时限制）...');
      
      try {
        // wait() 不传参数 = 无超时限制
        receipt = await tx.wait();
        console.log('✅ 交易已确认');
        console.log('区块号:', receipt.blockNumber);
        console.log('Gas 使用:', receipt.gasUsed?.toString());
      } catch (waitError: any) {
        // 交易失败，但我们可以从错误中获取交易回执
        if (waitError.receipt) {
          receipt = waitError.receipt;
          console.log('❌ 交易已 revert，从异常中获取交易回执');
        } else {
          throw waitError;
        }
      }
    } else if (tx && typeof tx === 'object' && tx.hash) {
      // 这是一个交易哈希对象
      receipt = tx;
    } else {
      // 这可能是一个只读函数的返回值，或者交易直接返回结果
      console.log('✅ 函数执行成功（只读函数）');
      console.log('返回值:', tx);
      const safeResult = convertBigIntToString(tx);
      return ok({ message: '函数执行成功', result: safeResult });
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

    // 构造响应
    const response: any = {
      message: '函数执行成功',
      txHash: receipt.hash || tx.hash,
      blockNumber: receipt.blockNumber?.toString() || '0',
      gasUsed: receipt.gasUsed?.toString() || '0',
    };

    // 尝试获取返回值（尽管是无返回值函数）
    // 对于有返回值的函数，我们已经成功获取了（在else分支返回）
    // 对于无返回值函数，设置result为”0x”(空布新)，表示执行成功但无返回值
    response.result = '0x'; // 无返回值

    console.log('========== 自定义函数执行成功 ==========');
    return ok(response);
  } catch (error: any) {
    console.error('❌ 执行自定义函数失败:', error);
    
    // 使用统一的错误解读函数
    const friendlyErrorMessage = parseBlockchainError(error);
    console.error('解读后的错误:', friendlyErrorMessage);
    
    return fail(friendlyErrorMessage, 500, { details: error.message || error.toString() });
  }
}
