import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ANVIL_RPC_URL = process.env.ANVIL_RPC_URL || 'http://anvil-api:8545';

async function callRpc(method: string, params: any[] = [], id = 1) {
  const res = await fetch(ANVIL_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'RPC调用失败');
  return data.result;
}

async function getLatestBlock() {
  const block = await callRpc('eth_getBlockByNumber', ['latest', false]);
  const numberHex = block?.number ?? '0x0';
  const tsHex = block?.timestamp ?? '0x0';
  const blockNumber = parseInt(numberHex, 16);
  const timestamp = parseInt(tsHex, 16);
  return { blockNumber, timestamp };
}

/**
 * GET /api/fork/time
 * 返回当前最新区块号与时间戳（秒）
 */
export async function GET() {
  try {
    const { blockNumber, timestamp } = await getLatestBlock();
    return NextResponse.json({ success: true, data: { blockNumber, timestamp } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '获取时间失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fork/time
 * { action: 'increase' | 'set' | 'mine' | 'interval' | 'reach', seconds?: number, timestamp?: number, blocks?: number }
 * - increase: 增加指定秒数并出块
 * - set: 设置下一个区块时间戳并出块
 * - mine: 立即出块，可选 blocks 指定出块数
 * - interval: 设置自动出块间隔（anvil_setBlockTimestampInterval）
 * - reach: 不改变其它设置的情况下，将时间推进到指定的 Unix 时间戳（秒）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || '').toLowerCase();
    const seconds = body.seconds !== undefined ? Number(body.seconds) : undefined;
    const timestamp = body.timestamp !== undefined ? Number(body.timestamp) : undefined;
    const blocks = body.blocks !== undefined ? Number(body.blocks) : 1;

    if (!['increase', 'set', 'mine', 'interval', 'reach'].includes(action)) {
      return NextResponse.json(
        { success: false, error: '不支持的操作类型' },
        { status: 400 }
      );
    }

    if (action === 'increase') {
      if (!seconds || !Number.isFinite(seconds) || seconds <= 0) {
        return NextResponse.json(
          { success: false, error: '请提供有效的秒数' },
          { status: 400 }
        );
      }
      // 兼容性处理：优先尝试 anvil_setBlockTimestampInterval，其次 evm_increaseTime
      try {
        await callRpc('evm_increaseTime', [seconds]);
      } catch (e) {
        // 忽略，部分实现可能不支持
      }
      // 出块使时间生效
      try {
        await callRpc('anvil_mine', [blocks]);
      } catch (e) {
        // 回退使用 evm_mine
        await callRpc('evm_mine', []);
      }
    } else if (action === 'set') {
      if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) {
        return NextResponse.json(
          { success: false, error: '请提供有效的Unix时间戳（秒）' },
          { status: 400 }
        );
      }
      // 设置下一个区块的时间戳
      await callRpc('evm_setNextBlockTimestamp', [timestamp]);
      // 出块使时间生效
      try {
        await callRpc('anvil_mine', [blocks]);
      } catch (e) {
        await callRpc('evm_mine', []);
      }
    } else if (action === 'mine') {
      if (!blocks || !Number.isFinite(blocks) || blocks <= 0) {
        return NextResponse.json(
          { success: false, error: '请提供有效的出块数量' },
          { status: 400 }
        );
      }
      try {
        await callRpc('anvil_mine', [blocks]);
      } catch (e) {
        // 回退到逐块挖矿
        for (let i = 0; i < blocks; i++) {
          await callRpc('evm_mine', []);
        }
      }
    } else if (action === 'interval') {
      if (!seconds || !Number.isFinite(seconds) || seconds < 0) {
        return NextResponse.json(
          { success: false, error: '请提供有效的出块间隔秒数' },
          { status: 400 }
        );
      }
      // 设置自动出块时间间隔（0 表示关闭自动定时出块）
      await callRpc('anvil_setBlockTimestampInterval', [seconds]);
    } else if (action === 'reach') {
      if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) {
        return NextResponse.json(
          { success: false, error: '请提供有效的目标时间戳（秒）' },
          { status: 400 }
        );
      }
      // 查询当前最新时间，如果已达到或超过目标，则直接返回
      const latest = await getLatestBlock();
      if (latest.timestamp >= timestamp) {
        return NextResponse.json({ success: true, data: latest });
      }
      // 设置下一个区块的时间戳为目标值，然后出块使其生效
      await callRpc('evm_setNextBlockTimestamp', [timestamp]);
      try {
        await callRpc('anvil_mine', [1]);
      } catch (e) {
        await callRpc('evm_mine', []);
      }
    }

    const latest = await getLatestBlock();
    return NextResponse.json({ success: true, data: latest });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '时间推进失败' },
      { status: 500 }
    );
  }
}