import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

/**
 * GET /api/user/likes
 *
 * 获取当前用户点赞过的帖子列表
 * 支持分页：?page=1&limit=10
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    // 查询用户点赞的帖子（type=LIKE）
    const [likes, total] = await Promise.all([
      prisma.like.findMany({
        where: {
          userId: user.userId,
          type: 'LIKE',
          postId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          post: {
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
            },
          },
        },
      }),
      prisma.like.count({
        where: {
          userId: user.userId,
          type: 'LIKE',
          postId: { not: null },
        },
      }),
    ]);

    // 过滤掉已删除帖子的点赞，并格式化
    const posts = likes
      .filter((like) => like.post && like.post.status === 'PUBLISHED')
      .map((like) => ({
        id: String(like.post!.id),
        title: like.post!.title,
        summary:
          like.post!.content.length > 200
            ? like.post!.content.substring(0, 200) + '...'
            : like.post!.content,
        category: like.post!.category
          ? {
              id: String(like.post!.category.id),
              name: like.post!.category.name,
              slug: like.post!.category.slug,
            }
          : null,
        author: {
          username: like.post!.author.username,
          avatar: like.post!.author.avatar,
        },
        viewCount: like.post!.viewCount,
        likeCount: like.post!.likeCount,
        commentCount: like.post!.commentCount,
        isPinned: like.post!.isPinned,
        isEssence: like.post!.isEssence,
        createdAt: like.post!.createdAt,
        likedAt: like.createdAt,
      }));

    return NextResponse.json({
      posts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[USER LIKES ERROR]', error);
    return NextResponse.json(
      { error: '获取点赞列表失败' },
      { status: 500 }
    );
  }
}
