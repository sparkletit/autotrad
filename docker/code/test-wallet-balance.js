// 测试钱包余额API
const testWalletBalance = async () => {
  const walletAddress = '0x6ca9e317b92c85a20f78a80442dcb76fb7077777';
  const chain = 'bsc';
  
  try {
    const response = await fetch(`http://localhost:8888/api/balances/wallet-balance?walletAddress=${walletAddress}&chain=${chain}`);
    const data = await response.json();
    
    console.log('钱包余额API响应:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log(`\n✅ 成功获取钱包余额:`);
      console.log(`总资产价值: $${data.data.totalUsdValue}`);
      console.log(`代币数量: ${data.data.tokenBalances.length}`);
      
      data.data.tokenBalances.forEach((token, index) => {
        console.log(`\n${index + 1}. ${token.tokenName} (${token.tokenSymbol})`);
        console.log(`   地址: ${token.tokenAddress}`);
        console.log(`   余额: ${token.balanceEth}`);
        console.log(`   USD价值: $${token.usdValue}`);
        console.log(`   单价: $${token.usdPrice}`);
      });
    } else {
      console.log(`\n❌ 错误: ${data.message}`);
    }
  } catch (error) {
    console.error('请求失败:', error);
  }
};

// 运行测试
testWalletBalance();