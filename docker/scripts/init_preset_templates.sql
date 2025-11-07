-- 初始化预制模板
-- PancakeSwap V2 Router: 0x10ED43C718714eb63d5aA57B78B54704E256024E
-- PancakeSwap V3 Router: 0x13f4EA83D0bd40E75C8222255bc855a974568Dd4

-- 删除旧的预制模板（如果存在）
DELETE FROM custom_function_templates WHERE is_preset = 1;

-- PancakeSwap V2 - swapExactTokensForTokens (交换代币)
INSERT INTO custom_function_templates (
  account_address, contract_address, abi_content, function_name, params_json, description, is_preset
) VALUES (
  '0x0000000000000000000000000000000000000000',
  '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  '[{"type":"function","name":"swapExactTokensForTokens","inputs":[{"name":"amountIn","type":"uint256"},{"name":"amountOutMin","type":"uint256"},{"name":"path","type":"address[]"},{"name":"to","type":"address"},{"name":"deadline","type":"uint256"}],"outputs":[{"name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable"}]',
  'swapExactTokensForTokens',
  '{"amountIn":"0","amountOutMin":"0","path":["0x0000000000000000000000000000000000000000","0x0000000000000000000000000000000000000000"],"to":"0x0000000000000000000000000000000000000000","deadline":"0"}',
  'PancakeSwap V2 - 交换代币',
  1
);

-- PancakeSwap V2 - addLiquidity (添加流动性)
INSERT INTO custom_function_templates (
  account_address, contract_address, abi_content, function_name, params_json, description, is_preset
) VALUES (
  '0x0000000000000000000000000000000000000000',
  '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  '[{"type":"function","name":"addLiquidity","inputs":[{"name":"tokenA","type":"address"},{"name":"tokenB","type":"address"},{"name":"amountADesired","type":"uint256"},{"name":"amountBDesired","type":"uint256"},{"name":"amountAMin","type":"uint256"},{"name":"amountBMin","type":"uint256"},{"name":"to","type":"address"},{"name":"deadline","type":"uint256"}],"outputs":[{"name":"amountA","type":"uint256"},{"name":"amountB","type":"uint256"},{"name":"liquidity","type":"uint256"}],"stateMutability":"nonpayable"}]',
  'addLiquidity',
  '{"tokenA":"0x0000000000000000000000000000000000000000","tokenB":"0x0000000000000000000000000000000000000000","amountADesired":"0","amountBDesired":"0","amountAMin":"0","amountBMin":"0","to":"0x0000000000000000000000000000000000000000","deadline":"0"}',
  'PancakeSwap V2 - 添加流动性',
  1
);

-- PancakeSwap V2 - removeLiquidity (移除流动性)
INSERT INTO custom_function_templates (
  account_address, contract_address, abi_content, function_name, params_json, description, is_preset
) VALUES (
  '0x0000000000000000000000000000000000000000',
  '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  '[{"type":"function","name":"removeLiquidity","inputs":[{"name":"tokenA","type":"address"},{"name":"tokenB","type":"address"},{"name":"liquidity","type":"uint256"},{"name":"amountAMin","type":"uint256"},{"name":"amountBMin","type":"uint256"},{"name":"to","type":"address"},{"name":"deadline","type":"uint256"}],"outputs":[{"name":"amountA","type":"uint256"},{"name":"amountB","type":"uint256"}],"stateMutability":"nonpayable"}]',
  'removeLiquidity',
  '{"tokenA":"0x0000000000000000000000000000000000000000","tokenB":"0x0000000000000000000000000000000000000000","liquidity":"0","amountAMin":"0","amountBMin":"0","to":"0x0000000000000000000000000000000000000000","deadline":"0"}',
  'PancakeSwap V2 - 移除流动性',
  1
);

-- PancakeSwap V3 - exactInputSingle (交换代币 - 单路径)
INSERT INTO custom_function_templates (
  account_address, contract_address, abi_content, function_name, params_json, description, is_preset
) VALUES (
  '0x0000000000000000000000000000000000000000',
  '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
  '[{"type":"function","name":"exactInputSingle","inputs":[{"name":"params","type":"tuple","components":[{"name":"tokenIn","type":"address"},{"name":"tokenOut","type":"address"},{"name":"fee","type":"uint24"},{"name":"recipient","type":"address"},{"name":"deadline","type":"uint256"},{"name":"amountIn","type":"uint256"},{"name":"amountOutMinimum","type":"uint256"},{"name":"sqrtPriceLimitX96","type":"uint160"}]}],"outputs":[{"name":"amountOut","type":"uint256"}],"stateMutability":"payable"}]',
  'exactInputSingle',
  '{"params":{"tokenIn":"0x0000000000000000000000000000000000000000","tokenOut":"0x0000000000000000000000000000000000000000","fee":"3000","recipient":"0x0000000000000000000000000000000000000000","deadline":"0","amountIn":"0","amountOutMinimum":"0","sqrtPriceLimitX96":"0"}}',
  'PancakeSwap V3 - 交换代币（单路径）',
  1
);

-- PancakeSwap V3 - multicall (添加流动性 - 使用multicall)
INSERT INTO custom_function_templates (
  account_address, contract_address, abi_content, function_name, params_json, description, is_preset
) VALUES (
  '0x0000000000000000000000000000000000000000',
  '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
  '[{"type":"function","name":"multicall","inputs":[{"name":"data","type":"bytes[]"}],"outputs":[{"name":"results","type":"bytes[]"}],"stateMutability":"payable"}]',
  'multicall',
  '{"data":["0x"]}',
  'PancakeSwap V3 - 添加流动性（使用multicall）',
  1
);

-- PancakeSwap V3 - multicall (移除流动性 - 使用multicall)
-- 注意：V3的移除流动性也使用multicall，但需要不同的data
INSERT INTO custom_function_templates (
  account_address, contract_address, abi_content, function_name, params_json, description, is_preset
) VALUES (
  '0x0000000000000000000000000000000000000000',
  '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
  '[{"type":"function","name":"multicall","inputs":[{"name":"data","type":"bytes[]"}],"outputs":[{"name":"results","type":"bytes[]"}],"stateMutability":"payable"}]',
  'multicall',
  '{"data":["0x"]}',
  'PancakeSwap V3 - 移除流动性（使用multicall）',
  1
);

