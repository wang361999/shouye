import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

// ============ GET /api/admin/stats - 仪表盘统计数据 ============
export async function GET(request: NextRequest) {
  try {
    // admin鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    // ---- 日期计算 ----
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    // 本周开始（周一）
    const dayOfWeek = now.getDay() || 7; // 周日=7
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - dayOfWeek + 1);

    // 本月开始
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // ---- 并行查询基础统计 ----
    const [
      toolCount,
      postCount,
      userCount,
      todayNewPosts,
      pendingComments,
      hotTools,
      newToolsThisMonth,
      newPostsThisWeek,
      newUsersThisWeek,
    ] = await Promise.all([
      // 工具总数
      prisma.tool.count({ where: { isActive: true } }),
      // 帖子总数（排除已删除）
      prisma.post.count({ where: { status: { not: 'DELETED' } } }),
      // 用户总数
      prisma.user.count(),
      // 今日新增帖子数
      prisma.post.count({
        where: {
          status: { not: 'DELETED' },
          createdAt: { gte: todayStart },
        },
      }),
      // 待审核评论数
      prisma.comment.count({ where: { isApproved: false, deletedAt: null } }),
      // 热门工具Top5（按点击量排序）
      prisma.tool.findMany({
        where: { isActive: true },
        orderBy: { clickCount: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          icon: true,
          clickCount: true,
          category: true,
          createdAt: true,
        },
      }),
      // 本月新增工具数
      prisma.tool.count({
        where: { createdAt: { gte: monthStart } },
      }),
      // 本周新增帖子数
      prisma.post.count({
        where: {
          status: { not: 'DELETED' },
          createdAt: { gte: weekStart },
        },
      }),
      // 本周新增用户数
      prisma.user.count({
        where: { createdAt: { gte: weekStart } },
      }),
    ]);

    // ---- 近7天帖子趋势 ----
    const postTrend = await prisma.$queryRaw<
      Array<{ date: string; count: bigint }>
    >`
      SELECT DATE("created_at") as date, COUNT(*)::bigint as count
      FROM "Post"
      WHERE "created_at" >= ${sevenDaysAgo}
        AND "status" != 'DELETED'
      GROUP BY DATE("created_at")
      ORDER BY date ASC
    `;

    // 补齐可能缺失的日期，保证7天都有数据
    const trendMap = new Map(
      postTrend.map((item) => [String(item.date), Number(item.count)])
    );
    const fullTrend = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      fullTrend.push({
        date: dateStr,
        count: trendMap.get(dateStr) || 0,
      });
    }

    // ---- 最新动态 ----
    // 最近5条帖子
    const recentPosts = await prisma.post.findMany({
      where: { status: { not: 'DELETED' } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        author: { select: { id: true, username: true, avatar: true } },
      },
    });

    // 最近5条用户注册
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        avatar: true,
        createdAt: true,
      },
    });

    // 最近5条工具创建
    const recentTools = await prisma.tool.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        icon: true,
        createdAt: true,
      },
    });

    // 合并并按时间排序
    const recentActivities = [
      ...recentPosts.map((p) => ({
        type: 'post' as const,
        id: p.id,
        title: p.title,
        username: p.author.username,
        createdAt: p.createdAt,
      })),
      ...recentUsers.map((u) => ({
        type: 'user' as const,
        id: u.id,
        title: `${u.username} 注册了账号`,
        username: u.username,
        createdAt: u.createdAt,
      })),
      ...recentTools.map((t) => ({
        type: 'tool' as const,
        id: t.id,
        title: `新增工具：${t.name}`,
        username: '管理员',
        createdAt: t.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // ---- 返回统计数据 ----
    return NextResponse.json({
      toolCount,
      postCount,
      userCount,
      todayVisits: todayNewPosts, // 用今日新增帖子数估算
      todayNewPosts,
      pendingComments,
      postTrend: fullTrend,
      hotTools,
      recentActivities,
      newToolsThisMonth,
      newPostsThisWeek,
      newUsersThisWeek,
    });
  } catch (error) {
    console.error('[ADMIN STATS ERROR]', error);
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}
