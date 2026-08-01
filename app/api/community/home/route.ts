import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { stripMarkdown, truncateText, formatTimeAgo } from '@/lib/utils';

// 缓存 5 分钟（社区首页数据更新较频繁，但不需要实时）
export const revalidate = 300;

/**
 * GET /api/community/home - 社区首页聚合数据
 * 一次性返回：最新帖子、热门讨论、活跃成员、社区统计
 */
export async function GET() {
  try {
    // 并行查询所有数据
    const [latestPosts, hotPosts, activeMembers, stats] = await Promise.all([
      // 1. 最新帖子（6条）
      prisma.post.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: 6,
        select: {
          id: true,
          title: true,
          content: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          isPinned: true,
          isEssence: true,
          createdAt: true,
          author: {
            select: { id: true, username: true, avatar: true },
          },
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),

      // 2. 热门讨论（按 点赞+浏览 排序，5条）
      prisma.post.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ isPinned: 'desc' }, { likeCount: 'desc' }, { viewCount: 'desc' }],
        take: 5,
        select: {
          id: true,
          title: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          isPinned: true,
          isEssence: true,
          createdAt: true,
          author: {
            select: { id: true, username: true, avatar: true },
          },
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),

      // 3. 活跃成员（按发帖数+评论数排序，8人）
      prisma.user.findMany({
        where: { status: 'active' },
        orderBy: [{ postCount: 'desc' }, { commentCount: 'desc' }],
        take: 8,
        select: {
          id: true,
          username: true,
          avatar: true,
          bio: true,
          postCount: true,
          commentCount: true,
        },
      }),

      // 4. 社区统计
      (async () => {
        const [userCount, postCount, commentCount, todayPostCount] = await Promise.all([
          prisma.user.count(),
          prisma.post.count({ where: { status: 'PUBLISHED' } }),
          prisma.comment.count({ where: { deletedAt: null, isApproved: true } }),
          prisma.post.count({
            where: {
              status: 'PUBLISHED',
              createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            },
          }),
        ]);
        return { userCount, postCount, commentCount, todayPostCount };
      })(),
    ]);

    // 格式化最新帖子
    const formattedLatest = latestPosts.map((p) => ({
      id: p.id,
      title: p.title,
      summary: truncateText(stripMarkdown(p.content), 120),
      viewCount: p.viewCount,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      isPinned: p.isPinned,
      isEssence: p.isEssence,
      timeAgo: formatTimeAgo(p.createdAt),
      author: p.author,
      category: p.category,
    }));

    // 格式化热门讨论
    const formattedHot = hotPosts.map((p) => ({
      id: p.id,
      title: p.title,
      viewCount: p.viewCount,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      isPinned: p.isPinned,
      isEssence: p.isEssence,
      timeAgo: formatTimeAgo(p.createdAt),
      author: p.author,
      category: p.category,
    }));

    // 格式化活跃成员
    const formattedMembers = activeMembers.map((u) => ({
      id: u.id,
      username: u.username,
      avatar: u.avatar,
      bio: u.bio || '',
      postCount: u.postCount,
      commentCount: u.commentCount,
    }));

    return NextResponse.json({
      latestPosts: formattedLatest,
      hotPosts: formattedHot,
      activeMembers: formattedMembers,
      stats,
    });
  } catch (error) {
    console.error('[COMMUNITY HOME ERROR]', error);
    return NextResponse.json({
      latestPosts: [],
      hotPosts: [],
      activeMembers: [],
      stats: { userCount: 0, postCount: 0, commentCount: 0, todayPostCount: 0 },
    });
  }
}
