'use client';


import React, { useState, useEffect } from 'react';
import apiService from '@/lib/apiService';
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
  is_preset?: number;
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
  const [chainId, setChainId] = useState<string>('1'); // 默认以太坊主网

  // 获取链信息
  const fetchChainInfo = async () => {
    try {
      const { success, data } = await apiService.get('/api/fork/chain-info?network=fork');
      if (success && data) {
        setChainId(data.chainId.toString());
      } else {
        // 如果无法获取链信息，默认使用以太坊主网
        setChainId('1');
      }
    } catch (error) {
      console.error('获取链信息失败:', error);
      // 出错时默认使用以太坊主网
      setChainId('1');
    }
  };
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
  const [presetTemplates, setPresetTemplates] = useState<FunctionTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<FunctionTemplate | null>(null);
  const [abiLoading, setAbiLoading] = useState(false);
  const [abiFetchError, setAbiFetchError] = useState('');

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
    fetchChainInfo(); // 获取链信息
  }, []);

  // 页面加载时获取模板列表
  useEffect(() => {
    fetchTemplates();
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

  // 当ABI内容更新时，如果有待加载的模板，则继续加载
  useEffect(() => {
    if (pendingTemplate && parsedABI.length > 0) {
      // ABI已解析完成，现在设置函数和参数
      const func = parsedABI.find((f) => f.name === pendingTemplate.function_name);
      if (func) {
        setSelectedFunction(pendingTemplate.function_name);
        try {
          const params = JSON.parse(pendingTemplate.params_json);
          setFunctionParams(params);
        } catch (e) {
          console.error('解析参数失败:', e);
        }
      }
      setPendingTemplate(null);
    }
  }, [parsedABI, pendingTemplate]);

  const fetchAbi = async (silent: boolean = false) => {
    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) return;
    try {
      if (!silent) setError('');
      setAbiFetchError('');
      setAbiLoading(true);
      const { success, data, error } = await apiService.get(`/api/abi/${contractAddress}?chainId=${chainId}`);
      if (!success) {
        setAbiFetchError(error || '获取ABI失败');
        if (!silent) setError(error || '获取ABI失败');
        return;
      }
      const abiStr = (data as any)?.abi || '';
      let pretty = abiStr;
      try {
        pretty = JSON.stringify(JSON.parse(abiStr), null, 2);
      } catch {}
      setAbiContent(pretty);
      setSuccess('ABI已自动填充');
    } catch (e: any) {
      setAbiFetchError(e.message || '获取ABI失败');
      if (!silent) setError(e.message || '获取ABI失败');
    } finally {
      setAbiLoading(false);
    }
  };

  useEffect(() => {
    if (contractAddress && /^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      const t = setTimeout(() => {
        if (!abiContent) fetchAbi(true);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [contractAddress, abiContent]);



  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      // 获取历史模板（排除预制模板）
      const { success: hSucc, data: hData } = await apiService.get('/api/custom-functions?exclude_preset=true');
      if (hSucc) {
        setTemplates((hData as any) || []);
      }
      
      // 获取预制模板
      const { success: pSucc, data: pData } = await apiService.get('/api/custom-functions?preset_only=true');
      if (pSucc) {
        setPresetTemplates((pData as any) || []);
      }
    } catch (err) {
      console.error('获取模板列表失败:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleMigrate = async () => {
    if (!confirm('确定要执行数据库迁移吗？这将添加 is_preset 字段到数据库表中。')) {
      return;
    }
    
    try {
      setLoadingTemplates(true);
      const { success, data, error } = await apiService.post('/api/custom-functions/migrate');
      if (success) {
        if ((data as any)?.migrated) {
          setSuccess('数据库迁移成功！现在可以初始化预制模板了。');
        } else {
          setSuccess('数据库已是最新版本，无需迁移。');
        }
        await fetchTemplates();
      } else {
        setError(error || '迁移失败');
      }
    } catch (err) {
      console.error('数据库迁移失败:', err);
      setError('数据库迁移失败');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleInitPresets = async () => {
    if (!confirm('确定要初始化预制模板吗？这将删除所有现有的预制模板并重新创建。')) {
      return;
    }
    
    try {
      setLoadingTemplates(true);
      const { success, data, error } = await apiService.post('/api/custom-functions/init-presets');
      if (success) {
        setSuccess(`成功初始化 ${((data as any)?.count) || 0} 个预制模板`);
        await fetchTemplates();
      } else {
        setError(error || '初始化失败');
        // 如果是因为缺少字段，提示用户执行迁移
        if (error && error.includes('is_preset')) {
          setTimeout(() => {
            if (confirm('需要先执行数据库迁移。是否现在执行？')) {
              handleMigrate();
            }
          }, 1000);
        }
      }
    } catch (err) {
      console.error('初始化预制模板失败:', err);
      setError('初始化预制模板失败');
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
      const { success: eSucc, data: eData, error: eErr } = await apiService.post('/api/custom-functions/execute', {
        account_address: selectedAccount,
        contract_address: contractAddress,
        abi_content: abiContent,
        function_name: selectedFunction,
        params: paramsArray,
        gas_limit: gasLimit === 'auto' ? 'auto' : customGasLimit,
        value: ethValue || '0',
      });

      if (!eSucc) {
        setError(eErr || '执行失败');
        setLoading(false);
        return;
      }

      setSuccess('函数执行成功！');
      setTxHash((eData as any)?.txHash);
      setResult((eData as any)?.result);

      // 保存到数据库
      const { success: sSucc2, data: sData2 } = await apiService.post('/api/custom-functions', {
        account_address: selectedAccount,
        contract_address: contractAddress,
        abi_content: abiContent,
        function_name: selectedFunction,
        params_json: JSON.stringify(functionParams),
        description: description || null,
      });
      if (sSucc2) {
        // 根据是否已存在显示不同消息
        if ((sData2 as any)?.existed) {
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
    setDescription(template.description || '');
    // 先设置待死模板，然后设置ABI
    // 当ABI加载完成后，会自动触发useEffect来加载函数和参数
    setPendingTemplate(template);
    setAbiContent(template.abi_content);
  };

  const handleDeleteTemplate = async (id: number, isPreset: boolean = false) => {
    const message = isPreset 
      ? '确定要删除此预制模板吗？' 
      : '确定要删除此模板吗？';
    if (!confirm(message)) return;

    try {
      const { success, error } = await apiService.delete(`/api/custom-functions?id=${id}`);
      if (success) {
        setSuccess('模板删除成功');
        await fetchTemplates();
      } else {
        setError(error || '删除失败');
      }
    } catch (err) {
      console.error('删除模板失败:', err);
      setError('删除模板失败');
    }
  };

  const handleMigrateToPreset = async (templateId: number) => {
    if (!confirm('确定要将此历史模板迁移到预制模板吗？如果已存在相同的预制模板，将更新其参数。')) {
      return;
    }

    try {
      setLoadingTemplates(true);
      const response = await fetch('/api/custom-functions/migrate-to-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      const data = await response.json();
      if (data.success) {
        if (data.data.updated) {
          setSuccess('模板已迁移到预制模板，并更新了已存在的预制模板参数');
        } else {
          setSuccess('模板已迁移到预制模板');
        }
        await fetchTemplates();
      } else {
        setError(data.error || '迁移失败');
      }
    } catch (err) {
      console.error('迁移模板失败:', err);
      setError('迁移模板失败');
    } finally {
      setLoadingTemplates(false);
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
                  <div className="flex items-center space-x-2">
                    <div className="flex-1">
                      <UnifiedAddressSelector
                        value={contractAddress}
                        onChange={setContractAddress}
                        placeholder="搜索或选择合约地址..."
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchAbi(false)}
                      disabled={!contractAddress || abiLoading}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50"
                    >
                      ABI
                    </button>
                  </div>
                  {abiLoading && (
                    <p className="text-xs text-gray-600 mt-1">正在获取ABI...</p>
                  )}
                  {abiFetchError && (
                    <p className="text-xs text-red-600 mt-1">{abiFetchError}</p>
                  )}
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

              {/* 预制模板 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">预制模板</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleMigrate}
                      disabled={loadingTemplates}
                      className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white rounded transition-colors"
                      title="执行数据库迁移"
                    >
                      迁移
                    </button>
                    <button
                      onClick={handleInitPresets}
                      disabled={loadingTemplates}
                      className="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded transition-colors"
                      title="初始化预制模板"
                    >
                      初始化
                    </button>
                  </div>
                </div>

                {loadingTemplates ? (
                  <p className="text-sm text-gray-500 text-center py-4">加载中...</p>
                ) : presetTemplates.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-2">暂无预制模板</p>
                    <button
                      onClick={handleInitPresets}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      点击初始化预制模板
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {presetTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="p-4 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs font-semibold rounded">
                                  预制
                                </span>
                                <p className="text-sm font-semibold text-gray-900">
                                  {template.function_name}
                                </p>
                              </div>
                              {template.description && (
                                <p className="text-xs text-gray-600 mt-1">{template.description}</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteTemplate(template.id, true)}
                              className="text-red-500 hover:text-red-700 text-xs ml-2"
                              title="删除预制模板"
                            >
                              删除
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 font-mono">
                            合约: {template.contract_address.slice(0, 6)}...
                            {template.contract_address.slice(-4)}
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

              {/* 历史模板 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">历史模板</h3>

                {loadingTemplates ? (
                  <p className="text-sm text-gray-500 text-center py-4">加载中...</p>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">暂无历史模板</p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
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
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleMigrateToPreset(template.id)}
                                className="text-green-600 hover:text-green-800 text-xs"
                                title="迁移到预制模板"
                              >
                                迁移
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="text-red-500 hover:text-red-700 text-xs"
                                title="删除模板"
                              >
                                删除
                              </button>
                            </div>
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
