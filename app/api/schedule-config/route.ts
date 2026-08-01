import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
      return NextResponse.json(DEFAULT_SCHEDULE);
    }

    const config = { ...DEFAULT_SCHEDULE, ...JSON.parse(setting.value) };
    return NextResponse.json(config);
  } catch {
    return NextResponse.json(DEFAULT_SCHEDULE);
  }
}
