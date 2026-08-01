import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// ============ 根据声望值计算徽章 ============
// 0-9 newcomer, 10-49 contributor, 50-199 expert, 200+ master
function getBadge(reputation: number): string {
  if (reputation >= 200) return 'master';
  if (reputation >= 50) return 'expert';
  if (reputation >= 10) return 'contributor';
  return 'newcomer';
}

// ============ GET /api/forum/reputation - 获取用户声望信息和徽章 ============
// ?userId=xxx 指定用户，不传则获取当前登录用户
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;

    // 若未指定 userId，则获取当前登录用户
    let targetUserId = userId;
    if (!targetUserId) {
      const user = getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: '请先登录或指定 userId' },
          { status: 401 }
        );
      }
      targetUserId = user.userId;
    }

    // ---- 查询用户基本信息 ----
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        avatar: true,
        reputation: true,
        badge: true,
        postCount: true,
        commentCount: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // ---- 计算收到的点赞数（用户帖子被点赞的总数）----
    const likeReceived = await prisma.like.count({
      where: {
        type: 'LIKE',
        post: { authorId: targetUserId },
      },
    });

    // ---- 计算徽章（数据库 badge 为空时按规则实时计算）----
    const badge = targetUser.badge || getBadge(targetUser.reputation);

    return NextResponse.json({
      userId: targetUser.id,
      username: targetUser.username,
      avatar: targetUser.avatar,
      reputation: targetUser.reputation,
      badge,
      postCount: targetUser.postCount,
      commentCount: targetUser.commentCount,
      likeReceived,
    });
  } catch (error) {
    console.error('[REPUTATION ERROR]', error);
    return NextResponse.json(
      { error: '获取声望信息失败' },
      { status: 500 }
    );
  }
}
