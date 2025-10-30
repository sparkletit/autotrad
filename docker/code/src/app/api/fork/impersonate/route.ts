import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/fork/impersonate
 * 在 Anvil fork 中模拟账户（允许该账户执行交易而无需私钥）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json(
        { success: false, error: '缺少参数：address' },
        { status: 400 }
      );
    }

    const rpcUrl = 'http://host.docker.internal:8545';

    // 使用 anvil_impersonateAccount 来模拟账户
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'anvil_impersonateAccount',
        params: [address],
        id: 1,
      }),
    });

    const result = await response.json();

    if (result.error) {
      console.error('模拟账户失败:', result.error);
      return NextResponse.json(
        { success: false, error: result.error.message || '模拟账户失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `已成功模拟账户 ${address}`,
      data: {
        address,
        impersonated: true,
      },
    });
  } catch (error) {
    console.error('模拟账户出错:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '模拟账户失败',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fork/impersonate
 * 停止模拟账户
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json(
        { success: false, error: '缺少参数：address' },
        { status: 400 }
      );
    }

    const rpcUrl = 'http://host.docker.internal:8545';

    // 使用 anvil_stopImpersonatingAccount 来停止模拟
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'anvil_stopImpersonatingAccount',
        params: [address],
        id: 1,
      }),
    });

    const result = await response.json();

    if (result.error) {
      console.error('停止模拟账户失败:', result.error);
      return NextResponse.json(
        { success: false, error: result.error.message || '停止模拟账户失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `已停止模拟账户 ${address}`,
    });
  } catch (error) {
    console.error('停止模拟账户出错:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '停止模拟账户失败',
      },
      { status: 500 }
    );
  }
}
