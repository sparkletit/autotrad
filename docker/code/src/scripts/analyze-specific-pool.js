const { createPublicClient, http, parseAbi } = require('viem');
const { bsc, mainnet, polygon, arbitrum, optimism } = require('viem/chains');

// Pool address to analyze
const POOL_ADDRESS = '0x13ef62d14bc340b25bea5df98d022adde2e40896';
const TOKEN_ADDRESS = '0x6ca9e317b92c85a20f78a80442dcb76fb7077777';

// Standard Uniswap V2 Pair ABI
const PAIR_ABI = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function factory() view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)'
]);

// Factory ABI to check if pool was created by known factories
const FACTORY_ABI = parseAbi([
  'function getPair(address tokenA, address tokenB) view returns (address pair)'
]);

// Known DEX factories
const DEX_FACTORIES = {
  bsc: {
    PancakeSwap: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    BakerySwap: '0x01bF7C66c6BD861915CdaaE475042d3b4f775595',
    ApeSwap: '0x0841BD0B734E4F5853f0dD8d7Ea041c241fb0Da6',
    Biswap: '0x858E3312ed3A876341EA81A4aC0C2d2FCbd07a82'
  },
  mainnet: {
    UniswapV2: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    SushiSwap: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
    ShibaSwap: '0x115934131916c8b277f010928e7b147fac2c77b8'
  },
  polygon: {
    QuickSwap: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
    SushiSwap: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    ApeSwap: '0xCf083Be4164828f00cAEbE3e17cBf474522a9eD9'
  },
  arbitrum: {
    UniswapV2: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    SushiSwap: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    Camelot: '0x6EcCab422D763aC031210895C8177E87B7Aaea6E'
  },
  optimism: {
    UniswapV2: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    Velodrome: '0x25CbdDb98b35ab1FF77410456D31Aea9a064dd13'
  }
};

// Create clients for different chains
const clients = {
  bsc: createPublicClient({ chain: bsc, transport: http() }),
  mainnet: createPublicClient({ chain: mainnet, transport: http() }),
  polygon: createPublicClient({ chain: polygon, transport: http() }),
  arbitrum: createPublicClient({ chain: arbitrum, transport: http() }),
  optimism: createPublicClient({ chain: optimism, transport: http() })
};

async function analyzePool() {
  console.log('=== Analyzing Trading Pool ===');
  console.log('Pool Address:', POOL_ADDRESS);
  console.log('Token Address:', TOKEN_ADDRESS);
  console.log('');

  // Try to analyze the pool on different chains
  for (const [chainName, client] of Object.entries(clients)) {
    console.log(`--- Checking on ${chainName.toUpperCase()} ---`);
    
    try {
      // Check if the address has code (is a contract)
      const bytecode = await client.getBytecode({ address: POOL_ADDRESS });
      
      if (!bytecode || bytecode === '0x') {
        console.log(`❌ No contract found at ${POOL_ADDRESS} on ${chainName}`);
        continue;
      }
      
      console.log(`✅ Contract found on ${chainName}`);
      console.log(`Bytecode length: ${bytecode.length}`);
      
      // Try to get basic pair information
      try {
        const token0 = await client.readContract({
          address: POOL_ADDRESS,
          abi: PAIR_ABI,
          functionName: 'token0'
        });
        
        const token1 = await client.readContract({
          address: POOL_ADDRESS,
          abi: PAIR_ABI,
          functionName: 'token1'
        });
        
        console.log(`✅ This is a valid pair contract!`);
        console.log(`Token0: ${token0}`);
        console.log(`Token1: ${token1}`);
        
        // Check if our target token is one of the pair tokens
        const tokenIsInPair = token0.toLowerCase() === TOKEN_ADDRESS.toLowerCase() || 
                             token1.toLowerCase() === TOKEN_ADDRESS.toLowerCase();
        
        console.log(`Target token is in pair: ${tokenIsInPair ? '✅ YES' : '❌ NO'}`);
        
        // Get reserves
        try {
          const reserves = await client.readContract({
            address: POOL_ADDRESS,
            abi: PAIR_ABI,
            functionName: 'getReserves'
          });
          
          console.log(`Reserves:`);
          console.log(`  Reserve0: ${reserves[0].toString()}`);
          console.log(`  Reserve1: ${reserves[1].toString()}`);
          console.log(`  Last Update: ${new Date(Number(reserves[2]) * 1000).toISOString()}`);
        } catch (error) {
          console.log(`⚠️  Could not get reserves: ${error.message}`);
        }
        
        // Get factory
        try {
          const factory = await client.readContract({
            address: POOL_ADDRESS,
            abi: PAIR_ABI,
            functionName: 'factory'
          });
          
          console.log(`Factory: ${factory}`);
          
          // Check if this factory is a known DEX factory
          const knownFactories = DEX_FACTORIES[chainName] || {};
          const factoryName = Object.entries(knownFactories).find(
            ([name, addr]) => addr.toLowerCase() === factory.toLowerCase()
          );
          
          if (factoryName) {
            console.log(`✅ This pool was created by ${factoryName[0]} factory`);
          } else {
            console.log(`⚠️  Unknown factory - might be a different DEX protocol`);
          }
          
        } catch (error) {
          console.log(`⚠️  Could not get factory: ${error.message}`);
        }
        
        // Get pair info
        try {
          const name = await client.readContract({
            address: POOL_ADDRESS,
            abi: PAIR_ABI,
            functionName: 'name'
          });
          
          const symbol = await client.readContract({
            address: POOL_ADDRESS,
            abi: PAIR_ABI,
            functionName: 'symbol'
          });
          
          console.log(`Pair Name: ${name}`);
          console.log(`Pair Symbol: ${symbol}`);
        } catch (error) {
          console.log(`⚠️  Could not get pair info: ${error.message}`);
        }
        
      } catch (error) {
        console.log(`❌ Not a standard pair contract: ${error.message}`);
        
        // Try to get some basic info even if it's not a standard pair
        try {
          const name = await client.readContract({
            address: POOL_ADDRESS,
            abi: parseAbi(['function name() view returns (string)']),
            functionName: 'name'
          });
          console.log(`Contract name: ${name}`);
        } catch (e) {
          console.log(`Could not get contract name`);
        }
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`❌ Error analyzing on ${chainName}: ${error.message}`);
      console.log('');
    }
  }
  
  console.log('=== Analysis Complete ===');
}

// Run the analysis
analyzePool().catch(console.error);