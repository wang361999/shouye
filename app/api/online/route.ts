import { NextRequest, NextResponse } from 'next/server';
import { recordHeartbeat, getOnlineCount } from '@/lib/online-tracker';

/**
 * 在线人数 API
 *
 * GET  /api/online       — 获取当前在线人数
 * POST /api/online       — 客户端心跳，刷新在线状态
 *
 * 心跳协议：
 *   客户端生成唯一 sessionId（localStorage 持久化），每 30 秒 POST 一次。
 *   服务端记录 lastSeen，超过 90 秒未心跳视为离线。
 */

export const dynamic = 'force-dynamic';

/** GET — 获取在线人数 */
export async function GET() {
  const count = getOnlineCount();
  return NextResponse.json(
    { online: count, ts: Date.now() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  );
}

/** POST — 客户端心跳 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === 'string' && body.sessionId.length > 0
      ? body.sessionId.slice(0, 64) // 防止超长字符串
      : '';

    if (!sessionId) {
      return NextResponse.json(
        { error: '缺少 sessionId' },
        { status: 400 },
      );
    }

    recordHeartbeat(sessionId);
    const count = getOnlineCount();

    return NextResponse.json(
      { online: count, ts: Date.now() },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: '心跳处理失败' },
      { status: 500 },
    );
  }
}
