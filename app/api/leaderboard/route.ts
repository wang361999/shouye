import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ============ GET /api/leaderboard - 用户排行榜 ============
export async function GET() {
  try {
    // 声望排行榜（Top 10）
    const reputationLeaders = await prisma.user.findMany({
      where: { status: 'active' },
      orderBy: { reputation: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        reputation: true,
        postCount: true,
        commentCount: true,
      },
    });

    // 发帖排行榜（Top 10）
    const postLeaders = await prisma.user.findMany({
      where: { status: 'active' },
      orderBy: { postCount: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        reputation: true,
        postCount: true,
        commentCount: true,
      },
    });

    // 今日签到排行榜（最近签到，Top 10）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkInLeaders = await prisma.checkIn.findMany({
      where: { checkInDate: today },
      orderBy: { continuousDays: 'desc' },
      take: 10,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            bio: true,
          },
        },
      },
    });

    return NextResponse.json({
      reputation: reputationLeaders.map((u, i) => ({
        rank: i + 1,
        ...u,
      })),
      posts: postLeaders.map((u, i) => ({
        rank: i + 1,
        ...u,
      })),
      checkIn: checkInLeaders.map((c, i) => ({
        rank: i + 1,
        id: c.user.id,
        username: c.user.username,
        avatar: c.user.avatar,
        bio: c.user.bio,
        continuousDays: c.continuousDays,
        expReward: c.expReward,
      })),
    });
  } catch (error) {
    console.error('[LEADERBOARD ERROR]', error);
    return NextResponse.json(
      { reputation: [], posts: [], checkIn: [] },
      { status: 200 },
    );
  }
}
