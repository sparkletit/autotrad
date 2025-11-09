const { Web3 } = require('web3');

// ==================== 配置区域 ====================
// RPC节点地址（按优先级排序，如果第一个失败会自动尝试下一个）
const RPC_URLS = [
    'https://bsc-dataseed2.defibit.io/',
    'https://1rpc.io/bnb',
    'https://bsc.publicnode.com',
];

// PancakeSwap手续费率 (0.25% = 0.0025 for V2)
const FEE_RATE = 0.0025;

// RPC请求超时时间（毫秒）
const RPC_TIMEOUT = 30000; // 30秒

// Pair配置数组，可以配置多个pair
const CONFIG = [
    {
        // PancakeSwap V2 Pair合约地址
        pairAddress: '0xc3311152e8c75fe80db5debf2008dd3f4fc2e121',
        
        // 目标token储备量
        // 支持两种格式：
        // 1. 百分比: "50%" 表示当前储备量的50%，"150%" 表示当前储备量的150%
        // 2. 绝对数值: "200000000000000000000" 表示200个token (200 * 10^18)
        targetReserve: '0.5%',
        
        // 目标token索引 (0 = token0, 1 = token1)
        targetTokenIndex: 0, // 0或1
        
        // Token精度（通常为18，需要根据实际token调整）
        token0Decimals: 18,
        token1Decimals: 18,
    },
    // 可以添加更多配置
    // {
    //     pairAddress: '0x...',
    //     targetReserve: '80%',
    //     targetTokenIndex: 1,
    //     token0Decimals: 18,
    //     token1Decimals: 18,
    // },
];

// PancakeSwap V2 Pair合约ABI（仅包含需要的函数）
const PAIR_ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "getReserves",
        "outputs": [
            { "internalType": "uint112", "name": "_reserve0", "type": "uint112" },
            { "internalType": "uint112", "name": "_reserve1", "type": "uint112" },
            { "internalType": "uint32", "name": "_blockTimestampLast", "type": "uint32" }
        ],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "token0",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "token1",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "type": "function"
    }
];

// ==================== 主函数 ====================
async function main() {
    try {
        console.log('='.repeat(60));
        console.log('PancakeSwap V2 Pair 计算器');
        console.log('='.repeat(60));
        console.log(`配置数量: ${format(CONFIG.length)}`);
        console.log('');
        
        // 验证配置
        if (!CONFIG || CONFIG.length === 0) {
            throw new Error('请配置CONFIG数组，至少添加一个pair配置');
        }
        
        // 选择可用的RPC节点
        console.log('正在测试RPC节点连接...');
        const rpcUrl = await selectAvailableRPC();
        console.log(`使用RPC节点: ${rpcUrl}`);
        console.log('');
        
        // 初始化Web3
        const web3 = new Web3(rpcUrl);
        
        // 设置请求超时
        if (web3.provider && web3.provider.request) {
            // 为HTTP provider设置超时
            const originalRequest = web3.provider.request.bind(web3.provider);
            web3.provider.request = async (args) => {
                return Promise.race([
                    originalRequest(args),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('RPC请求超时')), RPC_TIMEOUT)
                    )
                ]);
            };
        }
        
        // 遍历处理每个配置
        for (let i = 0; i < CONFIG.length; i++) {
            const config = CONFIG[i];
            
            // 验证配置项
            if (!config.pairAddress) {
                console.error(`配置项 ${i + 1}: 缺少pairAddress，跳过`);
                continue;
            }
            if (!config.targetReserve) {
                console.error(`配置项 ${i + 1}: 缺少targetReserve，跳过`);
                continue;
            }
            
            console.log('='.repeat(60));
            console.log(`配置项 ${i + 1}/${CONFIG.length}`);
            console.log('='.repeat(60));
            console.log(`Pair地址: ${config.pairAddress}`);
            console.log('');
            
            try {
                await processPair(web3, config, i + 1);
            } catch (error) {
                console.error(`配置项 ${i + 1} 处理失败:`, error.message);
                console.error('继续处理下一个配置项...');
            }
            
            // 如果不是最后一个，添加分隔
            if (i < CONFIG.length - 1) {
                console.log('');
            }
        }
        
        console.log('='.repeat(60));
        console.log('所有计算完成！');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('错误:', error.message);
        if (error.code === 'NETWORK_ERROR' || error.message.includes('connection')) {
            console.error('提示: 请检查RPC_URL配置是否正确');
        }
        process.exit(1);
    }
}

/**
 * 处理单个Pair配置
 * @param {Web3} web3 - Web3实例
 * @param {Object} config - 配置对象
 * @param {number} index - 配置索引
 */
async function processPair(web3, config, index) {
        // 创建Pair合约实例
        const pairContract = new web3.eth.Contract(PAIR_ABI, config.pairAddress);
        
        // 1. 查询当前储备数量
        console.log('1. 查询当前储备数量...');
        const reserves = await pairContract.methods.getReserves().call();
        const reserve0 = BigInt(reserves._reserve0);
        const reserve1 = BigInt(reserves._reserve1);
        
        console.log(`   Reserve0: ${format(reserve0, { decimals: config.token0Decimals, maxDecimals: config.token0Decimals, thousandSep: true, smallStyle: 'plain' })}`);
        console.log(`   Reserve1: ${format(reserve1, { decimals: config.token1Decimals, maxDecimals: config.token1Decimals, thousandSep: true, smallStyle: 'plain' })}`);
        console.log('');
        
        // 2. 计算当前K值
        const k = reserve0 * reserve1;
        console.log('2. 计算当前K值...');
        console.log(`   K = Reserve0 × Reserve1 = ${format(k, { scientificIfLarge: true })}`);
        console.log(`   K值 (格式化): ${format(k, { scientificIfLarge: true })}`);
        console.log('');
        
        // 3. 计算token价格
        console.log('3. 当前Token价格...');
        const price0 = format({ reserveA: reserve0, reserveB: reserve1, decimalsA: config.token0Decimals, decimalsB: config.token1Decimals }, { maxDecimals: 8, thousandSep: true, smallStyle: 'zeroCount' });
        const price1 = format({ reserveA: reserve1, reserveB: reserve0, decimalsA: config.token1Decimals, decimalsB: config.token0Decimals }, { maxDecimals: 8, thousandSep: true, smallStyle: 'zeroCount' });

        console.log(`   Token0价格 (以Token1计价): ${price0}`);
        console.log(`   Token1价格 (以Token0计价): ${price1}`);
        console.log('');
        
        // 4. 解析目标储备量（支持百分比和绝对数值）
        const currentReserve = config.targetTokenIndex === 0 ? reserve0 : reserve1;
        const targetDecimals = config.targetTokenIndex === 0 ? config.token0Decimals : config.token1Decimals;
        const { targetReserve, targetReserveDisplay, isPercentage, percentage } = parseTargetReserve(
            config.targetReserve,
            currentReserve,
            targetDecimals
        );
        
        const targetTokenName = config.targetTokenIndex === 0 ? 'Token0' : 'Token1';
        const inputTokenName = config.targetTokenIndex === 0 ? 'Token1' : 'Token0';
        // 确保decimals是数字类型
        const inputDecimals = Number(config.targetTokenIndex === 0 ? config.token1Decimals : config.token0Decimals);
        if (isNaN(inputDecimals)) {
            throw new Error(`无效的token精度配置: ${config.targetTokenIndex === 0 ? config.token1Decimals : config.token0Decimals}`);
        }
        
        // 计算达到目标储备量所需的输入量（不考虑手续费）
        console.log('4. 计算达到目标储备量所需的输入量（不考虑手续费）...');
        if (isPercentage) {
            console.log(`   目标${targetTokenName}储备量: ${percentage}% (${format(targetReserve, { decimals: targetDecimals, maxDecimals: targetDecimals, thousandSep: true, smallStyle: 'plain' })} ${targetTokenName})`);
        } else {
            console.log(`   目标${targetTokenName}储备量: ${format(targetReserve, { decimals: targetDecimals, maxDecimals: targetDecimals, thousandSep: true, smallStyle: 'plain' })} ${targetTokenName}`);
        }
        
        const resultNoFee = calculateInputAmount(
            reserve0,
            reserve1,
            targetReserve,
            config.targetTokenIndex,
            false
        );
        
        console.log(`   需要输入${inputTokenName}数量: ${format(resultNoFee.inputAmountNoFee, { decimals: inputDecimals, thousandSep: true, smallStyle: 'plain' })}`);
        console.log(`   交易后${targetTokenName}储备: ${format(targetReserve, { decimals: targetDecimals, thousandSep: true, smallStyle: 'plain' })}`);
        console.log(`   交易后${inputTokenName}储备: ${format(
            config.targetTokenIndex === 0 ? resultNoFee.newReserve1 : resultNoFee.newReserve0, 
            { decimals: inputDecimals, thousandSep: true, smallStyle: 'plain' }
        )}`);
        
        // 验证K值
        const kNoFee = resultNoFee.newReserve0 * resultNoFee.newReserve1;
        console.log(`   交易后K值: ${format(kNoFee, { scientificIfLarge: true })} (应该等于初始K)`);
        console.log(`   K值变化: ${((Number(kNoFee - k) / Number(k)) * 100).toFixed(8)}%`);
        console.log('');
        
        // 5. 计算达到目标储备量所需的输入量（考虑手续费）
        console.log('5. 计算达到目标储备量所需的输入量（考虑手续费，费率: ' + (FEE_RATE * 100) + '%）...');
        if (isPercentage) {
            console.log(`   目标${targetTokenName}储备量: ${percentage}% (${format(targetReserve, { decimals: targetDecimals, thousandSep: true, smallStyle: 'plain' })} ${targetTokenName})`);
        } else {
            console.log(`   目标${targetTokenName}储备量: ${format(targetReserve, { decimals: targetDecimals, thousandSep: true, smallStyle: 'plain' })} ${targetTokenName}`);
        }
        
        const resultWithFee = calculateInputAmount(
            reserve0,
            reserve1,
            targetReserve,
            config.targetTokenIndex,
            true
        );
        
        console.log(`   需要输入${inputTokenName}数量: ${format(resultWithFee.inputAmountWithFee, { decimals: inputDecimals, thousandSep: true, smallStyle: 'plain' })}`);
        console.log(`   实际进入池子的${inputTokenName}数量: ${format(
            (resultWithFee.inputAmountWithFee * BigInt(Math.floor((1 - FEE_RATE) * 10000))) / BigInt(10000),
            { decimals: inputDecimals, thousandSep: true, smallStyle: 'plain' }
        )} (扣除手续费)`);
        console.log(`   手续费: ${format(
            resultWithFee.inputAmountWithFee - (resultWithFee.inputAmountWithFee * BigInt(Math.floor((1 - FEE_RATE) * 10000))) / BigInt(10000),
            { decimals: inputDecimals, thousandSep: true, smallStyle: 'plain' }
        )} ${inputTokenName}`);
        
        const actualTargetReserve = config.targetTokenIndex === 0 ? resultWithFee.newReserve0 : resultWithFee.newReserve1;
        console.log(`   交易后${targetTokenName}储备: ${format(actualTargetReserve, { decimals: targetDecimals, thousandSep: true, smallStyle: 'plain' })}`);
        console.log(`   交易后${inputTokenName}储备: ${format(
            config.targetTokenIndex === 0 ? resultWithFee.newReserve1 : resultWithFee.newReserve0, 
            { decimals: inputDecimals, thousandSep: true, smallStyle: 'plain' }
        )}`);
        
        // 验证K值
        const kWithFee = resultWithFee.newReserve0 * resultWithFee.newReserve1;
        console.log(`   交易后K值: ${format(kWithFee, { scientificIfLarge: true })} (应该大于初始K)`);
        console.log(`   K值变化: ${((Number(kWithFee - k) / Number(k)) * 100).toFixed(8)}%`);
        console.log('');
}

// ==================== 辅助函数 ====================

/**
 * 选择可用的RPC节点
 * @returns {Promise<string>} 可用的RPC URL
 */
async function selectAvailableRPC() {
    for (let i = 0; i < RPC_URLS.length; i++) {
        const rpcUrl = RPC_URLS[i];
        try {
            console.log(`  尝试节点 ${i + 1}/${RPC_URLS.length}: ${rpcUrl}`);
            const web3 = new Web3(rpcUrl);
            
            // 测试连接：获取最新区块号
            const blockNumber = await Promise.race([
                web3.eth.getBlockNumber(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('连接超时')), 10000) // 10秒超时
                )
            ]);
            
            console.log(`  ✓ 节点可用，当前区块: ${format(blockNumber, { thousandSep: true })}`);
            return rpcUrl;
        } catch (error) {
            console.log(`  ✗ 节点不可用: ${error.message}`);
            if (i === RPC_URLS.length - 1) {
                throw new Error(`所有RPC节点都不可用。最后一个错误: ${error.message}`);
            }
        }
    }
    throw new Error('没有可用的RPC节点');
}

/**
 * 解析目标储备量（支持百分比和绝对数值）
 * @param {string} targetReserveStr - 目标储备量字符串（如 "50%" 或 "200000000000000000000"）
 * @param {BigInt} currentReserve - 当前储备量
 * @param {number} decimals - Token精度（用于显示）
 * @returns {Object} { targetReserve: BigInt, targetReserveDisplay: string, isPercentage: boolean, percentage?: number }
 */
function parseTargetReserve(targetReserveStr, currentReserve, decimals) {
    if (!targetReserveStr) {
        throw new Error('TARGET_RESERVE未配置');
    }
    
    const trimmed = targetReserveStr.trim();
    
    // 检查是否是百分比格式
    if (trimmed.endsWith('%')) {
        const percentageStr = trimmed.slice(0, -1);
        const percentage = parseFloat(percentageStr);
        
        if (isNaN(percentage) || percentage < 0) {
            throw new Error(`无效的百分比值: ${trimmed}`);
        }
        
        // 计算目标储备量: currentReserve * percentage / 100
        // 使用高精度计算避免浮点数误差
        // 支持最多6位小数精度（如 50.123456%）
        // percentage = 50 表示 50%，需要计算 currentReserve * 50 / 100
        // 先将percentage转换为整数：percentage * 1000000，然后取整
        const percentageMultiplier = Math.round(percentage * 1000000);
        if (percentageMultiplier < 0 || percentageMultiplier > 100000000) {
            throw new Error(`百分比值超出范围: ${percentage}%`);
        }
        const percentageBigInt = BigInt(percentageMultiplier);
        const divisor = BigInt(100000000);
        const targetReserve = (currentReserve * percentageBigInt) / divisor; // 除以100000000得到百分比
        
        return {
            targetReserve,
            targetReserveDisplay: `${percentage}%`,
            isPercentage: true,
            percentage: percentage
        };
    } else {
        // 绝对数值
        try {
            const targetReserve = BigInt(trimmed);
            if (targetReserve < BigInt(0)) {
                throw new Error('目标储备量不能为负数');
            }
            
            return {
                targetReserve,
                targetReserveDisplay: format(targetReserve, { decimals, thousandSep: true, smallStyle: 'plain' }),
                isPercentage: false
            };
        } catch (error) {
            throw new Error(`无效的目标储备量格式: ${trimmed}。支持格式: "50%" 或 "200000000000000000000"`);
        }
    }
}

/**
 * 计算token价格
 * @param {BigInt} reserveA - Token A的储备量
 * @param {BigInt} reserveB - Token B的储备量
 * @param {number} decimalsA - Token A的精度
 * @param {number} decimalsB - Token B的精度
 * @returns {string} 价格字符串
 */
function calculatePrice(reserveA, reserveB, decimalsA, decimalsB) {
    // 使用BigInt进行精确计算，并根据数值大小智能格式化
    // price = (reserveB / 10^decimalsB) / (reserveA / 10^decimalsA)
    //       = reserveB * 10^decimalsA / (reserveA * 10^decimalsB)
    // 为了得到小数，我们进一步乘以10^precision再做整数除法

    // 解析精度参数
    const parseDecimals = (d) => {
        let n;
        if (typeof d === 'number') n = Math.floor(d);
        else if (typeof d === 'string') n = Math.floor(parseFloat(d));
        else n = Math.floor(Number(d));
        if (isNaN(n) || n < 0 || n > 100) {
            throw new Error(`无效的精度值: ${d}`);
        }
        return n;
    };

    const decA = parseDecimals(decimalsA);
    const decB = parseDecimals(decimalsB);

    // 生成10的幂（BigInt）
    const pow10 = (n) => {
        let s = '1';
        for (let i = 0; i < n; i++) s += '0';
        return BigInt(s);
    };

    const precision = 18; // 额外的小数位，用于计算与展示
    if (reserveA === BigInt(0)) return 'Infinity';

    const numerator = reserveB * pow10(decA) * pow10(precision);
    const denominator = reserveA * pow10(decB);

    const scaled = numerator / denominator; // 整数，包含precision位小数
    const scaleP = pow10(precision);
    const whole = scaled / scaleP;
    const fractional = scaled % scaleP;
    const fractionalStr = fractional.toString().padStart(precision, '0');

    // 常规显示：最多8位小数；过小数值使用科学计数法避免显示为0
    const maxDisplayDecimals = 8;

    if (whole > BigInt(0)) {
        let decPart = fractionalStr.slice(0, maxDisplayDecimals).replace(/0+$/, '');
        const wholeStr = whole.toString();
        const wholeWithCommas = wholeStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return decPart.length ? `${wholeWithCommas}.${decPart}` : wholeWithCommas;
    } else {
        const firstNonZeroIdx = fractionalStr.search(/[1-9]/);
        if (firstNonZeroIdx === -1) {
            return `0.{${precision}}0`;
        }
        const exp = firstNonZeroIdx + 1; // 小数点后零的个数（按你的期望显示为指数值）
        const sigDigits = 5; // 显示5位有效数字
        const sig = fractionalStr.slice(firstNonZeroIdx, firstNonZeroIdx + sigDigits);
        return `0.{${exp}}${sig}`;
    }
}

/**
 * 根据目标储备量计算需要输入的token数量
 * @param {BigInt} reserve0 - Token0的当前储备量
 * @param {BigInt} reserve1 - Token1的当前储备量
 * @param {BigInt} targetReserve - 目标token的储备量
 * @param {number} targetTokenIndex - 目标token索引 (0或1)
 * @param {boolean} withFee - 是否考虑手续费
 * @returns {Object} { inputAmountNoFee, inputAmountWithFee, newReserve0, newReserve1 }
 */
function calculateInputAmount(reserve0, reserve1, targetReserve, targetTokenIndex, withFee) {
    const k = reserve0 * reserve1; // 当前K值
    const feeMultiplier = BigInt(Math.floor((1 - FEE_RATE) * 10000)); // 9975 for 0.25% fee
    
    let newReserve0, newReserve1, inputAmount, inputAmountNoFee;
    
    if (targetTokenIndex === 0) {
        // 目标是token0达到targetReserve，需要输入token1来换取token0
        // 不考虑手续费：K = targetReserve * newReserve1
        if (targetReserve === BigInt(0)) {
            throw new Error('目标储备量不能为0');
        }
        newReserve0 = targetReserve;
        newReserve1 = k / newReserve0;
        const requiredReserve1Increase = newReserve1 - reserve1;
        // 确保结果是BigInt类型
        inputAmountNoFee = requiredReserve1Increase;
        
        if (withFee) {
            // 考虑手续费：需要输入更多token1来补偿手续费
            // 实际进入池子的token1 = inputAmount * (1 - feeRate)
            // 要达到newReserve1，需要: newReserve1 = reserve1 + inputAmount * (1 - feeRate)
            // 所以: inputAmount = (newReserve1 - reserve1) / (1 - feeRate)
            inputAmount = (requiredReserve1Increase * BigInt(10000)) / feeMultiplier;
            
            // 重新计算实际的新储备量（考虑手续费）
            const actualInput = (inputAmount * feeMultiplier) / BigInt(10000);
            newReserve1 = reserve1 + actualInput;
            // 根据恒定乘积公式计算输出的token0
            // amountOut = (reserve0 * actualInput) / (reserve1 + actualInput)
            const token0Out = (reserve0 * actualInput) / (reserve1 + actualInput);
            newReserve0 = reserve0 - token0Out;
        } else {
            inputAmount = inputAmountNoFee;
        }
    } else {
        // 目标是token1达到targetReserve，需要输入token0来换取token1
        // 不考虑手续费：K = newReserve0 * targetReserve
        if (targetReserve === BigInt(0)) {
            throw new Error('目标储备量不能为0');
        }
        newReserve1 = targetReserve;
        newReserve0 = k / newReserve1;
        const requiredReserve0Increase = newReserve0 - reserve0;
        // 确保结果是BigInt类型
        inputAmountNoFee = requiredReserve0Increase;
        
        if (withFee) {
            // 考虑手续费
            inputAmount = (requiredReserve0Increase * BigInt(10000)) / feeMultiplier;
            
            // 重新计算实际的新储备量（考虑手续费）
            const actualInput = (inputAmount * feeMultiplier) / BigInt(10000);
            newReserve0 = reserve0 + actualInput;
            // 根据恒定乘积公式计算输出的token1
            // amountOut = (reserve1 * actualInput) / (reserve0 + actualInput)
            const token1Out = (reserve1 * actualInput) / (reserve0 + actualInput);
            newReserve1 = reserve1 - token1Out;
        } else {
            inputAmount = inputAmountNoFee;
        }
    }
    
    // 验证所有变量都已初始化
    if (inputAmountNoFee === undefined) {
        throw new Error('inputAmountNoFee 未初始化');
    }
    if (inputAmount === undefined) {
        throw new Error('inputAmount 未初始化');
    }
    if (newReserve0 === undefined) {
        throw new Error('newReserve0 未初始化');
    }
    if (newReserve1 === undefined) {
        throw new Error('newReserve1 未初始化');
    }
    
    // 确保所有返回值都是BigInt类型
    const ensureBigInt = (value, name) => {
        if (value === undefined || value === null) {
            throw new Error(`${name} 是 undefined 或 null`);
        }
        if (typeof value === 'bigint') {
            return value;
        }
        try {
            return BigInt(value);
        } catch (error) {
            throw new Error(`无法将 ${name} (${typeof value}: ${value}) 转换为 BigInt: ${error.message}`);
        }
    };
    
    return {
        inputAmountNoFee: ensureBigInt(inputAmountNoFee, 'inputAmountNoFee'),
        inputAmountWithFee: ensureBigInt(inputAmount, 'inputAmount'),
        newReserve0: ensureBigInt(newReserve0, 'newReserve0'),
        newReserve1: ensureBigInt(newReserve1, 'newReserve1')
    };
}

/**
 * 格式化数字显示
 * @param {BigInt} value - 数值
 * @param {number} decimals - 精度
 * @returns {string} 格式化后的字符串
 */
function formatNumber(value, decimals) {
    return format(value, { decimals, thousandSep: true, smallStyle: 'plain' });
}

/**
 * 格式化大数字（用于K值显示）
 * @param {BigInt} value - 数值
 * @returns {string} 格式化后的字符串
 */
function formatLargeNumber(value) {
    return format(value, { scientificIfLarge: true });
}

/**
 * 通用格式化方法：统一处理大数、带精度的金额，以及价格显示
 * 使用方式：
 * - 格式化金额（BigInt）: format(valueBigInt, { decimals, maxDecimals?, thousandSep?, scientificIfLarge? })
 * - 格式化价格：format({ reserveA, reserveB, decimalsA, decimalsB }, { maxDecimals?, thousandSep?, smallStyle?: 'plain'|'zeroCount', sigDigits? })
 */
function format(value, options = {}) {
    const defaultOpts = {
        decimals: undefined,
        maxDecimals: undefined,
        thousandSep: false,
        scientificIfLarge: false,
        // 价格相关
        smallStyle: 'plain', // 'plain' 显示为 0.xxxx；'zeroCount' 显示为 0.{n}digits
        sigDigits: 5,
    };
    const opts = { ...defaultOpts, ...options };

    const isPriceInput = (v) => v && typeof v === 'object' && 'reserveA' in v && 'reserveB' in v;

    const pow10 = (n) => {
        let s = '1';
        for (let i = 0; i < n; i++) s += '0';
        return BigInt(s);
    };

    const addThousandSep = (s) => opts.thousandSep ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : s;

    const parseDecimals = (d) => {
        if (d === undefined || d === null) return undefined;
        let n;
        if (typeof d === 'number') n = Math.floor(d);
        else if (typeof d === 'string') n = Math.floor(parseFloat(d));
        else n = Math.floor(Number(d));
        if (isNaN(n) || n < 0 || n > 100) {
            throw new Error(`无效的精度值: ${d}`);
        }
        return n;
    };

    if (isPriceInput(value)) {
        // 价格格式化
        const { reserveA, reserveB, decimalsA, decimalsB } = value;
        const decA = parseDecimals(decimalsA);
        const decB = parseDecimals(decimalsB);
        const precision = 18; // 计算精度
        if (reserveA === BigInt(0)) return 'Infinity';

        const numerator = reserveB * pow10(decA) * pow10(precision);
        const denominator = reserveA * pow10(decB);
        const scaled = numerator / denominator; // 整数，包含precision位小数
        const scaleP = pow10(precision);
        const whole = scaled / scaleP;
        const fractional = scaled % scaleP;
        const fractionalStr = fractional.toString().padStart(precision, '0');
        const maxDisplayDecimals = opts.maxDecimals ?? 8;

        if (whole > BigInt(0)) {
            const decPart = fractionalStr.slice(0, maxDisplayDecimals).replace(/0+$/, '');
            const wholeWithSep = addThousandSep(whole.toString());
            return decPart.length ? `${wholeWithSep}.${decPart}` : wholeWithSep;
        } else {
            const firstNonZeroIdx = fractionalStr.search(/[1-9]/);
            if (firstNonZeroIdx === -1) {
                // 全为0
                return opts.smallStyle === 'zeroCount' ? `0.{${precision}}0` : `0.${'0'.repeat(Math.min(2, maxDisplayDecimals))}`;
            }
            if (opts.smallStyle === 'zeroCount') {
                const exp = firstNonZeroIdx + 1;
                const sig = fractionalStr.slice(firstNonZeroIdx, firstNonZeroIdx + opts.sigDigits);
                return `0.{${exp}}${sig}`;
            } else {
                const visible = fractionalStr.slice(0, maxDisplayDecimals).replace(/0+$/, '');
                return visible.length ? `0.${visible}` : '0';
            }
        }
    }

    // 金额或整数格式化
    if (typeof value !== 'bigint') {
        try {
            value = BigInt(value);
        } catch (_) {
            throw new Error(`format: 非法的数值类型 ${typeof value}`);
        }
    }

    const dec = parseDecimals(opts.decimals);
    if (dec === undefined) {
        // 无精度，直接整数显示
        const str = value.toString();
        if (opts.scientificIfLarge && str.length > 18) {
            const exp = str.length - 1;
            const mantissa = str[0] + '.' + str.substring(1, 6);
            return `${mantissa}e${exp}`;
        }
        return addThousandSep(str);
    }

    // 带精度金额显示
    const divisor = pow10(dec);
    const isNeg = value < BigInt(0);
    let v = isNeg ? -value : value;
    const whole = v / divisor;
    const fractional = v % divisor;
    const wholeStr = addThousandSep(whole.toString());
    if (fractional === BigInt(0)) {
        return isNeg ? `-${wholeStr}` : wholeStr;
    }
    const fractionalStr = fractional.toString().padStart(dec, '0');
    const sliceLen = opts.maxDecimals ? Math.min(opts.maxDecimals, dec) : dec;
    const fracPart = fractionalStr.slice(0, sliceLen).replace(/0+$/, '');
    if (!fracPart.length) {
        return isNeg ? `-${wholeStr}` : wholeStr;
    }
    return isNeg ? `-${wholeStr}.${fracPart}` : `${wholeStr}.${fracPart}`;
}

// ==================== 执行 ====================
if (require.main === module) {
    main();
}

module.exports = {
    calculatePrice,
    calculateInputAmount,
    formatNumber,
    format,
    formatLargeNumber
};
