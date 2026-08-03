import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// ============ GET /api/badges/user - 获取用户已获得的徽章列表 ============
// 查询参数：
//   userId - 可选，指定查询的用户 ID；不传则使用当前登录用户
// 返回：该用户已获得的所有徽章（包含 badge 详情和颁发时间）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    // 确定查询的目标用户 ID
    let userId: string | null = targetUserId;

    // 如果未指定 userId，则使用当前登录用户
    if (!userId) {
      const user = getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: '未登录，请先登录或指定 userId 参数' },
          { status: 401 },
        );
      }
      userId = user.userId;
    }

    // 查询用户已获得的徽章（包含 badge 详情）
    const userBadges = await prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            type: true,
          },
        },
      },
      orderBy: { awardedAt: 'desc' },
    });

    const result = userBadges.map((ub) => ({
      id: ub.id,
      userId: ub.userId,
      badgeId: ub.badgeId,
      awardedAt: ub.awardedAt,
      badge: ub.badge,
    }));

    return NextResponse.json({ badges: result });
  } catch (error) {
    console.error('[USER BADGES ERROR]', error);
    return NextResponse.json(
      { error: '获取用户徽章失败' },
      { status: 500 },
    );
  }
}
