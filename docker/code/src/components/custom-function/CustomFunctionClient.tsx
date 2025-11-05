'use client';


import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import UnifiedAddressSelector from '@/components/common/UnifiedAddressSelector';
import { fetchAllAccounts } from '@/lib/addressService';

interface Account {
  id: number;
  account_name: string;
  address: string;
  type: 'main' | 'derived';
}

interface FunctionTemplate {
  id: number;
  account_address: string;
  contract_address: string;
  abi_content: string;
  function_name: string;
  params_json: string;
  description: string | null;
  created_at: string;
}

interface ABIFunction {
  name: string;
  type: string;
  inputs: Array<{
    name: string;
    type: string;
    internalType?: string;
  }>;
  outputs?: Array<{
    name: string;
    type: string;
  }>;
  stateMutability?: string;
}

const CustomFunctionPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [abiContent, setAbiContent] = useState('');
  const [parsedABI, setParsedABI] = useState<ABIFunction[]>([]);
  const [selectedFunction, setSelectedFunction] = useState('');
  const [functionParams, setFunctionParams] = useState<any>({});
  const [description, setDescription] = useState('');
  const [gasLimit, setGasLimit] = useState('auto');
  const [customGasLimit, setCustomGasLimit] = useState('');
  const [ethValue, setEthValue] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [txHash, setTxHash] = useState('');
  const [result, setResult] = useState<any>(null);

  const [templates, setTemplates] = useState<FunctionTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // 标记组件已挂载到客户端
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const loadAccounts = async () => {
      const allAccounts = await fetchAllAccounts();
      setAccounts(allAccounts);
    };
    loadAccounts();
  }, []);

  // 解析ABI
  useEffect(() => {
    if (abiContent.trim()) {
      try {
        const parsed = JSON.parse(abiContent);
        const functions = Array.isArray(parsed)
          ? parsed.filter((item) => item.type === 'function')
          : [];
        setParsedABI(functions);
        setError('');
      } catch (e) {
        setParsedABI([]);
        setError('ABI格式错误，请输入有效的JSON格式');
      }
    } else {
      setParsedABI([]);
    }
  }, [abiContent]);

  // 当选择函数时，初始化参数
  useEffect(() => {
    if (selectedFunction) {
      const func = parsedABI.find((f) => f.name === selectedFunction);
      if (func && func.inputs) {
        const params: any = {};
        func.inputs.forEach((input, index) => {
          params[input.name || `param${index}`] = '';
        });
        setFunctionParams(params);
      }
    }
  }, [selectedFunction, parsedABI]);



  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await fetch('/api/custom-functions');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data || []);
      }
    } catch (err) {
      console.error('获取模板列表失败:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedAccount || !contractAddress || !abiContent || !selectedFunction) {
      setError('请填写所有必要字段');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setTxHash('');

      // 准备参数数组
      const func = parsedABI.find((f) => f.name === selectedFunction);
      const paramsArray = func?.inputs?.map((input) => {
        const paramName = input.name || `param${func.inputs.indexOf(input)}`;
        return functionParams[paramName];
      }) || [];

      // 验证所有必需参数都已填入
      if (func?.inputs && func.inputs.length > 0) {
        for (let i = 0; i < func.inputs.length; i++) {
          const paramName = func.inputs[i].name || `param${i}`;
          if (paramsArray[i] === '' || paramsArray[i] === undefined || paramsArray[i] === null) {
            setError(`请填写第 ${i + 1} 个参数: ${paramName} (${func.inputs[i].type})`);
            setLoading(false);
            return;
          }
        }
      }

      console.log('\n【前端调试信息】');
      console.log('函数:', selectedFunction);
      console.log('参数对象:', functionParams);
      console.log('参数数组:', paramsArray);
      console.log('账户:', selectedAccount);
      console.log('合约:', contractAddress);

      // 执行函数
      const executeResponse = await fetch('/api/custom-functions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_address: selectedAccount,
          contract_address: contractAddress,
          abi_content: abiContent,
          function_name: selectedFunction,
          params: paramsArray,
          gas_limit: gasLimit === 'auto' ? 'auto' : customGasLimit,
          value: ethValue || '0',
        }),
      });

      const executeData = await executeResponse.json();
      if (!executeData.success) {
        setError(executeData.error || '执行失败');
        setLoading(false);
        return;
      }

      setSuccess('函数执行成功！');
      setTxHash(executeData.txHash);
      setResult(executeData.result);

      // 保存到数据库
      const saveResponse = await fetch('/api/custom-functions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_address: selectedAccount,
          contract_address: contractAddress,
          abi_content: abiContent,
          function_name: selectedFunction,
          params_json: JSON.stringify(functionParams),
          description: description || null,
        }),
      });

      const saveData = await saveResponse.json();
      if (saveData.success) {
        // 根据是否已存在显示不同消息
        if (saveData.data?.existed) {
          setSuccess('函数执行成功！模板已存在，无需重复保存');
        } else {
          setSuccess('函数执行成功！已保存为新模板');
        }
        await fetchTemplates();
      }
    } catch (err: any) {
      setError(err.message || '执行失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadTemplate = (template: FunctionTemplate) => {
    setSelectedAccount(template.account_address);
    setContractAddress(template.contract_address);
    setAbiContent(template.abi_content);
    setSelectedFunction(template.function_name);
    setDescription(template.description || '');
    try {
      const params = JSON.parse(template.params_json);
      setFunctionParams(params);
    } catch (e) {
      console.error('解析参数失败:', e);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('确定要删除此模板吗？')) return;

    try {
      const response = await fetch(`/api/custom-functions?id=${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        await fetchTemplates();
      }
    } catch (err) {
      console.error('删除模板失败:', err);
    }
  };

  const getCurrentFunction = (): ABIFunction | undefined => {
    return parsedABI.find((f) => f.name === selectedFunction);
  };

  return (
    <>
      <Header title="自定义函数" />
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">自定义合约函数执行</h1>

          <div className="grid grid-cols-3 gap-6">
            {/* 左侧：执行表单 */}
            <div className="col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
                <h2 className="text-xl font-bold text-gray-900">执行配置</h2>

                {/* 错误提示 */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {/* 成功提示 */}
                {success && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                    <p className="text-sm text-green-800">{success}</p>
                    {txHash && (
                      <p className="text-xs text-green-700 font-mono break-all">
                        交易哈希: {txHash}
                      </p>
                    )}
                  </div>
                )}

                {/* 选择账户 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    发送交易的账户 *
                  </label>
                  <UnifiedAddressSelector
                    value={selectedAccount}
                    onChange={setSelectedAccount}
                    placeholder="搜索或选择账户..."
                  />
                </div>

                {/* 合约地址 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    合约地址 *
                  </label>
                  <UnifiedAddressSelector
                    value={contractAddress}
                    onChange={setContractAddress}
                    placeholder="搜索或选择合约地址..."
                  />
                </div>

                {/* ABI内容 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    ABI内容 (JSON格式) *
                  </label>
                  <textarea
                    value={abiContent}
                    onChange={(e) => setAbiContent(e.target.value)}
                    placeholder='[{"type":"function","name":"transfer","inputs":[...]}]'
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {parsedABI.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ 已识别 {parsedABI.length} 个函数
                    </p>
                  )}
                </div>

                {/* 选择函数 */}
                {parsedABI.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      选择函数 *
                    </label>
                    <select
                      value={selectedFunction}
                      onChange={(e) => setSelectedFunction(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- 选择要执行的函数 --</option>
                      {parsedABI.map((func) => (
                        <option key={func.name} value={func.name}>
                          {func.name} (
                          {func.inputs?.map((input) => input.type).join(', ') || 'no params'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 函数参数 */}
                {selectedFunction && getCurrentFunction() && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900">函数参数</h3>
                    {getCurrentFunction()!.inputs && getCurrentFunction()!.inputs.length > 0 ? (
                      getCurrentFunction()!.inputs.map((input, index) => {
                        const paramName = input.name || `param${index}`;
                        return (
                          <div key={index}>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {paramName} ({input.type})
                            </label>
                            <input
                              type="text"
                              value={functionParams[paramName] || ''}
                              onChange={(e) =>
                                setFunctionParams({
                                  ...functionParams,
                                  [paramName]: e.target.value,
                                })
                              }
                              placeholder={`输入 ${input.type} 类型的值`}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-gray-500">此函数无需参数</p>
                    )}

                    {/* Gas Limit */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Gas Limit
                      </label>
                      <div className="flex gap-4 mb-2">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="auto"
                            checked={gasLimit === 'auto'}
                            onChange={(e) => setGasLimit(e.target.value)}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">自动预估</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="custom"
                            checked={gasLimit === 'custom'}
                            onChange={(e) => setGasLimit(e.target.value)}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">自定义</span>
                        </label>
                      </div>
                      {gasLimit === 'custom' && (
                        <input
                          type="number"
                          value={customGasLimit}
                          onChange={(e) => setCustomGasLimit(e.target.value)}
                          placeholder="例如: 3000000"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </div>

                    {/* ETH Value */}
                    {getCurrentFunction()?.stateMutability === 'payable' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          发送ETH/BNB数量
                        </label>
                        <input
                          type="text"
                          value={ethValue}
                          onChange={(e) => setEthValue(e.target.value)}
                          placeholder="0.0"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {/* 模板描述 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        模板描述（可选）
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="为此配置添加描述，方便后续使用"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* 参数JSON预览 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        参数JSON预览
                      </label>
                      <pre className="w-full px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-xs font-mono overflow-x-auto">
                        {JSON.stringify(functionParams, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* 执行按钮 */}
                <button
                  onClick={handleExecute}
                  disabled={
                    loading || !selectedAccount || !contractAddress || !abiContent || !selectedFunction
                  }
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                >
                  {loading ? '执行中...' : '执行函数并保存模板'}
                </button>
              </div>
            </div>

            {/* 右侧：执行结果区域 */}
            <div className="space-y-6">
              {/* 交易结果扮示 */}
              {(result !== null || txHash) && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">执行结果</h3>
                  <div className="space-y-3">
                    {/* 交易哈希 */}
                    {txHash && (
                      <div>
                        <p className="text-xs text-gray-600 mb-2 font-semibold">交易哈希：</p>
                        <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono overflow-x-auto text-gray-800 break-all">
                          {txHash}
                        </div>
                      </div>
                    )}

                    {/* 返回值 */}
                    {result !== null && result !== undefined ? (
                      <div>
                        <p className="text-xs text-gray-600 mb-2 font-semibold">返回值类型：</p>
                        <p className="text-sm text-gray-900">
                          {typeof result === 'object' ? 'Object' : typeof result}
                        </p>
                        <p className="text-xs text-gray-600 mb-2 font-semibold mt-3">返回值内容：</p>
                        <pre className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono overflow-x-auto text-gray-800">
                          {typeof result === 'string' 
                            ? result 
                            : JSON.stringify(result, null, 2)}
                        </pre>
                        {/* 特殊处理空返回值的情形 */}
                        {result === '0x' && (
                          <p className="text-xs text-gray-500 mt-2 italic">
                            表示此函数为无返回值函数（空字节，0x）
                          </p>
                        )}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              typeof result === 'string' 
                                ? result 
                                : JSON.stringify(result, null, 2)
                            );
                          }}
                          className="w-full px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-xs rounded transition-colors mt-2"
                        >
                          复制返回值
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800">
                          ✓ 无返回值的函数（状态修改函数）
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">历史模板</h3>

                {loadingTemplates ? (
                  <p className="text-sm text-gray-500 text-center py-4">加载中...</p>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">暂无模板</p>
                ) : (
                  <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">
                                {template.function_name}
                              </p>
                              {template.description && (
                                <p className="text-xs text-gray-600 mt-1">{template.description}</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="text-red-500 hover:text-red-700 text-xs ml-2"
                            >
                              删除
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 font-mono">
                            合约: {template.contract_address.slice(0, 6)}...
                            {template.contract_address.slice(-4)}
                          </p>
                          <p className="text-xs text-gray-500">
                            账户: {template.account_address.slice(0, 6)}...
                            {template.account_address.slice(-4)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(template.created_at).toLocaleString('zh-CN')}
                          </p>
                          <button
                            onClick={() => handleLoadTemplate(template)}
                            className="w-full mt-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                          >
                            加载模板
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 使用说明 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">使用说明</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex gap-2">
                    <span className="text-blue-500 font-bold">1</span>
                    <p>选择发送交易的账户</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-blue-500 font-bold">2</span>
                    <p>填写合约地址</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-blue-500 font-bold">3</span>
                    <p>粘贴ABI内容（JSON格式）</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-blue-500 font-bold">4</span>
                    <p>选择要执行的函数</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-blue-500 font-bold">5</span>
                    <p>填写函数参数</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-blue-500 font-bold">6</span>
                    <p>点击执行，自动保存为模板</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomFunctionPage;
