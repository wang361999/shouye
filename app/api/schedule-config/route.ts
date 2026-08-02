import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// 缓存 5 分钟，减少数据库查询（工作流检查频率已降低到每 6 小时）
export const revalidate = 300;

const SETTING_KEY = 'schedule_config';

const DEFAULT_SCHEDULE = {
  patrolEnabled: true,
  patrolHour: 10,
  posterEnabled: true,
  posterHour1: 9,
  posterHour2: 15,
  seoEnabled: true,
  seoHour: 14,
  creatorEnabled: true,
  creatorHour: 16,
  replyEnabled: true,
};

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (!setting) {
      return NextResponse.json(DEFAULT_SCHEDULE, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
      });
    }

    const config = { ...DEFAULT_SCHEDULE, ...JSON.parse(setting.value) };
    return NextResponse.json(config, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json(DEFAULT_SCHEDULE, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  }
}
