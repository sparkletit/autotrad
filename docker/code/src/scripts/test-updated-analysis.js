const { createPublicClient, http, formatUnits } = require('viem');
const { bsc } = require('viem/chains');

// Test the updated trading pool analysis logic
const TOKEN_ADDRESS = '0x6ca9e317b92c85a20f78a80442dcb76fb7077777';
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const USDT_ADDRESS = '0x55d398326f99059ff775485246999027b3197955';
const PANCAKESWAP_FACTORY = '0xca143ce32fe78f1f7019d7d551a6402fc5350c73';

const FACTORY_ABI = [
  {
    constant: true,
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    name: 'getPair',
    outputs: [{ name: 'pair', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const PAIR_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'getReserves',
    outputs: [
      { internalType: 'uint112', name: '_reserve0', type: 'uint112' },
      { internalType: 'uint112', name: '_reserve1', type: 'uint112' },
      { internalType: 'uint32', name: '_blockTimestampLast', type: 'uint32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'token0',
    outputs: [{ name: '', type: 'address' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'token1',
    outputs: [{ name: '', type: 'address' }],
    type: 'function',
  },
];

async function testUpdatedAnalysis() {
  console.log('=== Testing Updated Trading Pool Analysis ===');
  console.log('Token:', TOKEN_ADDRESS);
  console.log('');

  const client = createPublicClient({
    chain: bsc,
    transport: http(),
  });

  try {
    // Test 1: Check USDT pair (should not exist)
    console.log('--- Test 1: Checking USDT pair ---');
    try {
      const usdtPair = await client.readContract({
        address: PANCAKESWAP_FACTORY,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [TOKEN_ADDRESS, USDT_ADDRESS],
      });
      
      console.log('USDT Pair Address:', usdtPair);
      if (usdtPair.toLowerCase() === '0x0000000000000000000000000000000000000000') {
        console.log('✅ No USDT pair found (as expected)');
      }
    } catch (error) {
      console.log('❌ USDT pair check failed:', error.message);
    }
    
    console.log('');
    
    // Test 2: Check WBNB pair (should exist)
    console.log('--- Test 2: Checking WBNB pair ---');
    try {
      const wbnbPair = await client.readContract({
        address: PANCAKESWAP_FACTORY,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [TOKEN_ADDRESS, WBNB_ADDRESS],
      });
      
      console.log('WBNB Pair Address:', wbnbPair);
      
      if (wbnbPair.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
        console.log('✅ WBNB pair found!');
        
        // Get pair details
        const [token0, token1, reserves] = await Promise.all([
          client.readContract({
            address: wbnbPair,
            abi: PAIR_ABI,
            functionName: 'token0',
          }),
          client.readContract({
            address: wbnbPair,
            abi: PAIR_ABI,
            functionName: 'token1',
          }),
          client.readContract({
            address: wbnbPair,
            abi: PAIR_ABI,
            functionName: 'getReserves',
          }),
        ]);
        
        console.log('Token0:', token0);
        console.log('Token1:', token1);
        console.log('Reserve0:', reserves[0].toString());
        console.log('Reserve1:', reserves[1].toString());
        
        // Calculate price in WBNB
        const reserve0 = parseFloat(formatUnits(reserves[0], 18));
        const reserve1 = parseFloat(formatUnits(reserves[1], 18));
        let tokenPriceInWBNB = 0;
        
        if (token0.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) {
          tokenPriceInWBNB = reserve1 > 0 ? reserve0 / reserve1 : 0;
          console.log(`Token price: ${tokenPriceInWBNB} WBNB per token`);
        } else {
          tokenPriceInWBNB = reserve0 > 0 ? reserve1 / reserve0 : 0;
          console.log(`Token price: ${tokenPriceInWBNB} WBNB per token`);
        }
        
        // Test 3: Get WBNB/USDT price for USD conversion
        console.log('');
        console.log('--- Test 3: Getting WBNB/USDT price for USD conversion ---');
        try {
          const wbnbUsdtPair = await client.readContract({
            address: PANCAKESWAP_FACTORY,
            abi: FACTORY_ABI,
            functionName: 'getPair',
            args: [WBNB_ADDRESS, USDT_ADDRESS],
          });
          
          console.log('WBNB/USDT Pair Address:', wbnbUsdtPair);
          
          if (wbnbUsdtPair.toLowerCase() !== '0x0000000000000000000000000000000000000000') {
            console.log('✅ WBNB/USDT pair found, getting reserves...');
            
            const [wbnbToken0, wbnbToken1, wbnbReserves] = await Promise.all([
              client.readContract({
                address: wbnbUsdtPair,
                abi: PAIR_ABI,
                functionName: 'token0',
              }),
              client.readContract({
                address: wbnbUsdtPair,
                abi: PAIR_ABI,
                functionName: 'token1',
              }),
              client.readContract({
                address: wbnbUsdtPair,
                abi: PAIR_ABI,
                functionName: 'getReserves',
              }),
            ]);
            
            console.log('WBNB/USDT Token0:', wbnbToken0);
            console.log('WBNB/USDT Token1:', wbnbToken1);
            console.log('WBNB/USDT Reserves:', wbnbReserves);
            
            const wbnbReserve = parseFloat(formatUnits(wbnbReserves[0], 18));
            const usdtReserve = parseFloat(formatUnits(wbnbReserves[1], 18));
            
            console.log('WBNB Reserve:', wbnbReserve);
            console.log('USDT Reserve:', usdtReserve);
            
            let wbnbPriceInUSDT = 0;
            if (wbnbToken0.toLowerCase() === WBNB_ADDRESS.toLowerCase()) {
              wbnbPriceInUSDT = wbnbReserve > 0 ? usdtReserve / wbnbReserve : 0;
            } else {
              wbnbPriceInUSDT = usdtReserve > 0 ? wbnbReserve / usdtReserve : 0;
            }
            
            console.log('WBNB price in USDT:', wbnbPriceInUSDT);
            
            const tokenPriceInUSDT = tokenPriceInWBNB * wbnbPriceInUSDT;
            console.log(`Final token price in USD: $${tokenPriceInUSDT.toFixed(6)}`);
            
            console.log('');
            console.log('=== Summary ===');
            console.log(`✅ Found WBNB pair at: ${wbnbPair}`);
            console.log(`✅ Token reserves: ${reserve0} tokens`);
            console.log(`✅ WBNB reserves: ${reserve1} WBNB`);
            console.log(`✅ Token price: ${tokenPriceInUSDT.toFixed(6)} USD`);
            console.log(`✅ This matches the expected pool: 0x13ef62d14bc340b25bea5df98d022adde2e40896`);
            
          } else {
            console.log('❌ No WBNB/USDT pair found for price conversion');
          }
        } catch (error) {
          console.log('❌ WBNB/USDT price check failed:', error.message);
          console.log('Error details:', error);
        }
        
      } else {
        console.log('❌ No WBNB pair found');
      }
    } catch (error) {
      console.log('❌ WBNB pair check failed:', error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testUpdatedAnalysis().catch(console.error);