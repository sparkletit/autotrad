import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, Hex } from 'viem';
import { bsc } from 'viem/chains';

/**
 * GET /api/transfer/status?txHash=0x...
 * 检查交易状态
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txHash = searchParams.get('txHash');

    if (!txHash || !txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      return NextResponse.json(
        { success: false, error: '无效的交易哈希' },
        { status: 400 }
      );
    }

    const rpcUrl = process.env.ANVIL_RPC_URL || 'http://anvil-api:8545';
    const publicClient = createPublicClient({
      chain: bsc,
      transport: http(rpcUrl, { timeout: 10000 }),
    });

    try {
      // 获取交易回执
      const receipt = await publicClient.getTransactionReceipt({
        hash: txHash as Hex,
      });

      return NextResponse.json({
        success: true,
        status: receipt.status === 'success' ? 'confirmed' : 'failed',
        receipt: {
          status: receipt.status,
          blockNumber: receipt.blockNumber.toString(),
          gasUsed: receipt.gasUsed.toString(),
          transactionHash: receipt.transactionHash,
        },
      });
    } catch (err: any) {
      // 如果交易不存在或还在 pending，检查交易是否存在
      try {
        const tx = await publicClient.getTransaction({
          hash: txHash as Hex,
        });

        if (tx) {
          // 交易存在但还没有回执，说明还在 pending
          return NextResponse.json({
            success: true,
            status: 'pending',
            transaction: {
              hash: tx.hash,
              nonce: tx.nonce,
              from: tx.from,
              to: tx.to,
              value: tx.value.toString(),
            },
          });
        }
      } catch (txErr) {
        // 交易不存在
        return NextResponse.json({
          success: false,
          error: '交易不存在',
        });
      }

      throw err;
    }
  } catch (error) {
    console.error('检查交易状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '检查交易状态失败',
      },
      { status: 500 }
    );
  }
}

