/**
 * 格式化大数字显示
 * 对于小数，使用0.{12}1234这样的方式显示
 */
export function formatSmallNumber(value: string | number, decimals: number = 18): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(num)) return '0';
  if (num === 0) return '0';
  if (Math.abs(num) >= 0.0001) return num.toFixed(4);

  const sign = num < 0 ? '-' : '';
  const raw = typeof value === 'string' ? value : num.toString();

  const sci = raw.match(/^([0-9]*\.?[0-9]+)e-([0-9]+)$/i);
  if (sci) {
    const mantissa = sci[1].replace('.', '');
    const exp = parseInt(sci[2], 10);
    const zerosCount = Math.max(0, exp - 1);
    const sig = mantissa.replace(/^0+/, '').slice(0, 4) || '0';
    return `${sign}0.{${zerosCount}}${sig}`;
  }

  const parts = raw.split('.');
  if (parts.length === 2) {
    const decimalPart = parts[1].replace(/[^0-9]/g, '');
    const firstNonZero = decimalPart.search(/[1-9]/);
    if (firstNonZero !== -1) {
      const zerosCount = firstNonZero;
      const significant = decimalPart.slice(firstNonZero, firstNonZero + 4) || '0';
      return `${sign}0.{${zerosCount}}${significant}`;
    }
  }

  return `${sign}0`;
}

/**
 * 从wei转换为ether
 */
export function weiToEther(wei: string, decimals: number = 18): string {
  try {
    const weiBigInt = BigInt(wei);
    const divisor = BigInt(10 ** decimals);
    const ether = weiBigInt / divisor;
    const remainder = weiBigInt % divisor;
    
    if (remainder === BigInt(0)) {
      return ether.toString();
    }
    
    // 计算小数部分
    const remainderStr = remainder.toString().padStart(decimals, '0');
    const significantDigits = remainderStr.replace(/0+$/, '');
    
    if (significantDigits.length === 0) {
      return ether.toString();
    }
    
    return `${ether}.${significantDigits}`;
  } catch (error) {
    console.error('wei转换失败:', error);
    return '0';
  }
}

/**
 * 格式化货币显示
 */
export function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  } else if (value >= 1) {
    return `$${value.toFixed(2)}`;
  } else if (value >= 0.01) {
    return `$${value.toFixed(4)}`;
  } else {
    return `$${formatSmallNumber(value)}`;
  }
}

/**
 * 格式化代币数量
 */
export function formatTokenAmount(amount: string, decimals: number = 18): { wei: string; ether: string } {
  const ether = weiToEther(amount, decimals);
  return {
    wei: amount,
    ether: formatSmallNumber(ether, decimals)
  };
}

/**
 * 截断地址
 */
export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * 获取代币logo URL
 */
export function getTokenLogoUrl(address: string, chain: string): string {
  // 使用Trust Wallet的代币logo API
  const chainMap: { [key: string]: string } = {
    'bnb-mainnet': 'smartchain',
    'ethereum': 'ethereum',
    'polygon-mainnet': 'polygon',
    'arbitrum-mainnet': 'arbitrum',
    'optimism-mainnet': 'optimism'
  };
  
  const chainName = chainMap[chain] || 'ethereum';
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainName}/assets/${address}/logo.png`;
}