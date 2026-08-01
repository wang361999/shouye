import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// ============ GET /api/forum/feed - 获取关注动态流 ============
// 返回当前登录用户关注的人与分类的最新帖子，按 createdAt 降序，支持分页
export async function GET(request: NextRequest) {
  try {
    // 登录鉴权
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    // ---- 获取当前用户关注的人和分类 ----
    const follows = await prisma.follow.findMany({
      where: { followerId: user.userId },
      select: {
        followingId: true,
        categoryId: true,
      },
    });

    const followingUserIds = follows
      .map((f) => f.followingId)
      .filter((id): id is string => !!id);
    const followingCategoryIds = follows
      .map((f) => f.categoryId)
      .filter((id): id is string => !!id);

    // 若未关注任何用户或分类，直接返回空列表
    if (followingUserIds.length === 0 && followingCategoryIds.length === 0) {
      return NextResponse.json({
        posts: [],
        total: 0,
        page,
        totalPages: 0,
      });
    }

    // ---- 构建查询条件：关注的人发的帖 或 关注的分类下的帖 ----
    const where: Prisma.PostWhereInput = {
      status: 'PUBLISHED',
      OR: [
        ...(followingUserIds.length > 0 ? [{ authorId: { in: followingUserIds } }] : []),
        ...(followingCategoryIds.length > 0 ? [{ categoryId: { in: followingCategoryIds } }] : []),
      ],
    };

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      prisma.post.count({ where }),
    ]);

    return NextResponse.json({
      posts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[FEED ERROR]', error);
    return NextResponse.json(
      { error: '获取动态流失败' },
      { status: 500 }
    );
  }
}
