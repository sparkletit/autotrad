// Test the updated trading pool analysis API
const tokenId = 1; // The token ID for 0x6ca9e317b92c85a20f78a80442dcb76fb7077777

async function testUpdatedPoolsAnalysis() {
  console.log('=== Testing Updated Trading Pool Analysis ===');
  console.log('Token ID:', tokenId);
  console.log('Expected Pool: 0x13ef62d14bc340b25bea5df98d022adde2e40896 (WBNB pair)');
  console.log('');

  try {
    // Test with refresh to bypass cache
    const response = await fetch(`http://localhost:8888/api/import-tokens/${tokenId}/pools?refresh=true`);
    const data = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data) {
      const { summary, pools } = data.data;
      
      console.log('');
      console.log('=== Analysis Results ===');
      console.log('Total Pools Found:', summary.totalPools);
      console.log('Chains:', summary.chains);
      console.log('DEXs:', summary.dexes);
      console.log('Average Price:', `$${summary.averagePrice.toFixed(6)}`);
      
      if (pools && pools.length > 0) {
        console.log('');
        console.log('=== Pool Details ===');
        pools.forEach((pool, index) => {
          console.log(`Pool ${index + 1}:`);
          console.log(`  DEX: ${pool.dex}`);
          console.log(`  Chain: ${pool.chain}`);
          console.log(`  Pair Address: ${pool.pairAddress}`);
          console.log(`  Token0: ${pool.token0}`);
          console.log(`  Token1: ${pool.token1}`);
          console.log(`  Token0 Symbol: ${pool.token0Symbol}`);
          console.log(`  Token1 Symbol: ${pool.token1Symbol}`);
          console.log(`  USDT Price: $${pool.usdtPrice.toFixed(6)}`);
          console.log(`  Reserve0: ${pool.reserve0}`);
          console.log(`  Reserve1: ${pool.reserve1}`);
          console.log('');
          
          // Check if this is the expected pool
          if (pool.pairAddress.toLowerCase() === '0x13ef62d14bc340b25bea5df98d022adde2e40896') {
            console.log('🎉 SUCCESS: Found the expected WBNB trading pool!');
            console.log(`   This pool pairs the token with WBNB and has a price of $${pool.usdtPrice.toFixed(6)}`);
          }
        });
      } else {
        console.log('❌ No pools found');
      }
    } else {
      console.log('❌ API request failed:', data.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testUpdatedPoolsAnalysis();