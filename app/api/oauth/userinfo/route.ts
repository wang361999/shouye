import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/oauth/userinfo - 获取当前授权用户信息
 *
 * Header: Authorization: Bearer <access_token>
 *
 * 返回:
 *   { id, username, email, avatar, bio, role }
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: '缺少 Bearer token' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // 查找 token
    const accessToken = await prisma.oAuthAccessToken.findUnique({
      where: { token },
      include: {
        user: true,
        app: true,
      },
    });

    if (!accessToken) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: '令牌无效' },
        { status: 401 }
      );
    }

    // 检查过期
    if (accessToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: '令牌已过期' },
        { status: 401 }
      );
    }

    // 检查应用状态
    if (accessToken.app.status !== 'active') {
      return NextResponse.json(
        { error: 'invalid_token', error_description: '应用已被禁用' },
        { status: 401 }
      );
    }

    const user = accessToken.user;

    // 解析 scope 决定返回哪些字段
    const scope = (accessToken.scope || '').split(' ').filter(Boolean);
    const hasEmailScope = scope.length === 0 || scope.includes('user:email') || scope.includes('user:read');

    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: hasEmailScope ? user.email : undefined,
      avatar: user.avatar,
      bio: user.bio,
      role: user.role,
    });
  } catch (error) {
    console.error('[OAUTH USERINFO ERROR]', error);
    return NextResponse.json(
      { error: 'server_error', error_description: '获取用户信息失败' },
      { status: 500 }
    );
  }
}
