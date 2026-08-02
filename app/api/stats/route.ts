import { NextResponse } from 'next/server';
import { getDb, queryWithTimeout } from '@/lib/db';

// 模块级缓存：统计数据 10 分钟
let cachedStats: object | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 600_000;

/**
 * GET /api/stats - 公开统计接口（无需鉴权）
 *
 * 使用原生 SQL 替代 Prisma，4 个 COUNT 合并为 1 条查询。
 */
export async function GET() {
  const now = Date.now();
  if (cachedStats && now < cacheExpiry) {
    return NextResponse.json(cachedStats, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
    });
  }

  let db;
  try {
    db = getDb();
  } catch {
    return NextResponse.json(
      { error: '统计数据暂时不可用' },
      { status: 503 },
    );
  }

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const rows = await queryWithTimeout(
    db,
    `SELECT
       (SELECT COUNT(*) FROM Tool WHERE is_active = 1) as tool_count,
       (SELECT COUNT(*) FROM User) as user_count,
       (SELECT COUNT(*) FROM Post WHERE status = 'PUBLISHED') as post_count,
       (SELECT COUNT(*) FROM Post WHERE status = 'PUBLISHED' AND created_at >= ?) as today_post_count`,
    [todayStart],
    6000,
    [{ tool_count: 0, user_count: 0, post_count: 0, today_post_count: 0 }],
  );

  const row = (rows as Record<string, unknown>[])[0] || {};
  const result = {
    toolCount: Number(row.tool_count) || 0,
    userCount: Number(row.user_count) || 0,
    postCount: Number(row.post_count) || 0,
    todayPostCount: Number(row.today_post_count) || 0,
  };

  cachedStats = result;
  cacheExpiry = now + CACHE_TTL;

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
  });
}
