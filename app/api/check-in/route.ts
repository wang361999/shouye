import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// ============ GET /api/check-in - 获取签到状态 ============
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 查询今日是否已签到
    const todayCheckIn = await prisma.checkIn.findUnique({
      where: {
        userId_checkInDate: {
          userId: user.userId,
          checkInDate: today,
        },
      },
    });

    // 查询昨日签到（判断连续天数）
    const yesterdayCheckIn = await prisma.checkIn.findUnique({
      where: {
        userId_checkInDate: {
          userId: user.userId,
          checkInDate: yesterday,
        },
      },
    });

    // 查询最近7天签到记录
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const recentCheckIns = await prisma.checkIn.findMany({
      where: {
        userId: user.userId,
        checkInDate: { gte: sevenDaysAgo },
      },
      orderBy: { checkInDate: 'desc' },
    });

    // 计算当前连续签到天数
    let currentStreak = 0;
    if (todayCheckIn) {
      currentStreak = todayCheckIn.continuousDays;
    } else if (yesterdayCheckIn) {
      currentStreak = yesterdayCheckIn.continuousDays;
    }

    // 总签到天数
    const totalCheckIns = await prisma.checkIn.count({
      where: { userId: user.userId },
    });

    return NextResponse.json({
      checkedInToday: !!todayCheckIn,
      todayReward: todayCheckIn?.expReward || 0,
      currentStreak,
      totalCheckIns,
      recentCheckIns: recentCheckIns.map((c) => ({
        date: c.checkInDate.toISOString().split('T')[0],
        expReward: c.expReward,
        continuousDays: c.continuousDays,
      })),
      nextReward: calculateReward(currentStreak + 1),
    });
  } catch (error) {
    console.error('[CHECK-IN GET ERROR]', error);
    return NextResponse.json({ error: '获取签到状态失败' }, { status: 500 });
  }
}

// ============ POST /api/check-in - 执行签到 ============
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 检查今日是否已签到
    const existing = await prisma.checkIn.findUnique({
      where: {
        userId_checkInDate: {
          userId: user.userId,
          checkInDate: today,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: '今日已签到', checkedIn: true, expReward: existing.expReward },
        { status: 400 },
      );
    }

    // 查询昨日签到
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayCheckIn = await prisma.checkIn.findUnique({
      where: {
        userId_checkInDate: {
          userId: user.userId,
          checkInDate: yesterday,
        },
      },
    });

    // 计算连续天数
    const continuousDays = yesterdayCheckIn
      ? yesterdayCheckIn.continuousDays + 1
      : 1;

    // 计算奖励经验
    const expReward = calculateReward(continuousDays);

    // 创建签到记录
    const checkIn = await prisma.checkIn.create({
      data: {
        userId: user.userId,
        checkInDate: today,
        continuousDays,
        expReward,
      },
    });

    // 增加用户声望值
    await prisma.user.update({
      where: { id: user.userId },
      data: {
        reputation: { increment: expReward },
      },
    });

    return NextResponse.json({
      success: true,
      checkedIn: true,
      expReward,
      continuousDays,
      message: `签到成功！连续第 ${continuousDays} 天，获得 ${expReward} 声望值`,
    });
  } catch (error) {
    console.error('[CHECK-IN POST ERROR]', error);
    return NextResponse.json({ error: '签到失败，请稍后重试' }, { status: 500 });
  }
}

// ============ 签到奖励计算 ============
// 基础 10 声望 + 连续天数加成（每天 +2，上限 20）
// 连续 7 天额外奖励 50 声望
function calculateReward(continuousDays: number): number {
  let reward = 10 + Math.min(continuousDays - 1, 7) * 2;

  // 连续 7 天额外奖励
  if (continuousDays > 0 && continuousDays % 7 === 0) {
    reward += 50;
  }

  return reward;
}
