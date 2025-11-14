import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, encodeFunctionData, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { Address, Hex } from 'viem';
import { getPrivateKeyFromDatabase, parseBlockchainError, getRpcUrl, createHttpTransport } from '@/lib/serverUtils';
import { ZERO_ADDRESS, normalizeAddress, safeReadDecimals } from '@/lib/utils';

const PANCAKE_V3_ROUTER: Address = '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4';
const WBNB_ADDRESS: Address = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const V3_ROUTER_ABI = [
  {
    type: 'function',
    name: 'exactInputSingle',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
  },
] as const;

const ERC20_ABI = [
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const;

export async function POST(request: NextRequest) {
  let txHash: Hex | undefined;
  try {
    const body = await request.json();
    const {
      account,
      toAddress,
      tokenIn,
      tokenOut,
      amountIn,
      fee = 3000,
      slippage = '0.5',
      network = 'fork',
      sqrtPriceLimitX96 = '0',
      deadlineSeconds = 600,
    } = body;

    if (!account || !tokenIn || !tokenOut || !amountIn) {
      return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
    }

    const accountAddr = normalizeAddress(account);
    const nativeIn = tokenIn === ZERO_ADDRESS;
    const nativeOut = tokenOut === ZERO_ADDRESS;
    const tokenInAddr = nativeIn ? WBNB_ADDRESS : normalizeAddress(tokenIn);
    const tokenOutAddr = nativeOut ? WBNB_ADDRESS : normalizeAddress(tokenOut);
    const toAddr = toAddress ? normalizeAddress(toAddress) : accountAddr;

    const privateKey = await getPrivateKeyFromDatabase(accountAddr);
    if (!privateKey) {
      return NextResponse.json({ success: false, error: `账户 ${account} 的私钥不存在` }, { status: 400 });
    }

    const rpcUrl = getRpcUrl(network);
    const accountSigner = privateKeyToAccount(privateKey as Hex);
    const transport = createHttpTransport(rpcUrl, { timeout: 0, retryCount: 3, retryDelay: 1000 });

    const publicClient = createPublicClient({ chain: bsc, transport });
    const walletClient = createWalletClient({ account: accountSigner, chain: bsc, transport });

    const decimalsIn = nativeIn ? 18 : await safeReadDecimals(publicClient, tokenInAddr);
    const decimalsOut = nativeOut ? 18 : await safeReadDecimals(publicClient, tokenOutAddr);
    const amountInWei = parseUnits(amountIn, decimalsIn);

    if (!nativeIn) {
      const allowance = await publicClient.readContract({ address: tokenInAddr, abi: ERC20_ABI, functionName: 'allowance', args: [accountAddr, PANCAKE_V3_ROUTER] }) as bigint;
      if (allowance < amountInWei) {
        await walletClient.writeContract({ address: tokenInAddr, abi: ERC20_ABI, functionName: 'approve', args: [PANCAKE_V3_ROUTER, amountInWei] });
      }
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(deadlineSeconds));

    const simulate = await publicClient.simulateContract({
      address: PANCAKE_V3_ROUTER,
      abi: V3_ROUTER_ABI,
      functionName: 'exactInputSingle',
      account: accountSigner,
      args: [
        {
          tokenIn: tokenInAddr,
          tokenOut: tokenOutAddr,
          fee: Number(fee),
          recipient: toAddr,
          deadline,
          amountIn: amountInWei,
          amountOutMinimum: BigInt(0),
          sqrtPriceLimitX96: BigInt(sqrtPriceLimitX96),
        },
      ],
      value: nativeIn ? amountInWei : BigInt(0),
    });

    const expectedOut: bigint = simulate.result as bigint;
    const slip = slippage === 'auto' ? 0 : Math.max(0, Math.min(100, parseFloat(slippage)));
    const amountOutMin = slip === 0 ? BigInt(0) : (expectedOut * BigInt(Math.floor((100 - slip) * 100))) / BigInt(10000);

    const request = {
      address: PANCAKE_V3_ROUTER,
      abi: V3_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: tokenInAddr,
          tokenOut: tokenOutAddr,
          fee: Number(fee),
          recipient: toAddr,
          deadline,
          amountIn: amountInWei,
          amountOutMinimum: amountOutMin,
          sqrtPriceLimitX96: BigInt(sqrtPriceLimitX96),
        },
      ],
      value: nativeIn ? amountInWei : BigInt(0),
    } as const;

    txHash = await walletClient.writeContract(request);

    return NextResponse.json({
      success: true,
      data: {
        txHash,
        amountIn,
        expectedOut: formatUnits(expectedOut, decimalsOut),
        amountOutMin: formatUnits(amountOutMin, decimalsOut),
        fee,
        message: 'V3 Swap 交易已提交',
      },
    });
  } catch (error: any) {
    const friendlyErrorMessage = parseBlockchainError(error);
    return NextResponse.json(
      { success: false, error: friendlyErrorMessage, data: txHash ? { txHash } : undefined },
      { status: 500 }
    );
  }
}
