import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SETTING_KEY = 'schedule_config';

const DEFAULT_SCHEDULE = {
  patrolEnabled: true,
  patrolHour: 10,       // 巡检时间（北京时间）
  posterEnabled: true,
  posterHour1: 9,       // 第一篇帖子时间
  posterHour2: 15,      // 第二篇帖子时间
};

function parseConfig(value: string | undefined) {
  if (!value) return DEFAULT_SCHEDULE;
  try {
    return { ...DEFAULT_SCHEDULE, ...JSON.parse(value) };
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    return NextResponse.json(parseConfig(setting?.value));
  } catch (error) {
    console.error('[SCHEDULE GET ERROR]', error);
    return NextResponse.json({ error: '获取定时配置失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const config = {
      patrolEnabled: body.patrolEnabled !== false,
      patrolHour: Math.max(0, Math.min(23, Number(body.patrolHour) || 10)),
      posterEnabled: body.posterEnabled !== false,
      posterHour1: Math.max(0, Math.min(23, Number(body.posterHour1) || 9)),
      posterHour2: Math.max(0, Math.min(23, Number(body.posterHour2) || 15)),
    };

    await prisma.systemSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: JSON.stringify(config) },
      create: { key: SETTING_KEY, value: JSON.stringify(config) },
    });

    return NextResponse.json({ message: '定时配置已保存', config });
  } catch (error) {
    console.error('[SCHEDULE POST ERROR]', error);
    return NextResponse.json({ error: '保存定时配置失败' }, { status: 500 });
  }
}
