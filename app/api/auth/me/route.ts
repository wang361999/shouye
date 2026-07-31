import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, getTokenFromRequest } from '@/lib/auth';

/**
 * GET /api/auth/me - 获取当前登录用户信息
 *
 * 优先从 Authorization header 读取 token，回退到 httpOnly cookie。
 * 当 oauth_success=1 时，Header 组件调用此接口：
 *   1. 验证 cookie 中的 token（由 GitHub OAuth 回调设置）
 *   2. 返回 user + token，客户端同步到 localStorage / Zustand store
 *   3. 后续请求使用 Authorization header 携带 token
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    // 返回 token 以便客户端同步到 localStorage
    // （仅 GitHub OAuth 场景需要，普通登录时 token 已在 localStorage）
    const token = getTokenFromRequest(request);

    return NextResponse.json({
      user: {
        id: user.userId,
        username: user.username,
        role: user.role,
      },
      token: token || undefined,
    });
  } catch {
    return NextResponse.json(
      { error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}
