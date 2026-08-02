import { NextResponse } from 'next/server';
import { getDb, queryWithTimeout } from '@/lib/db';

// ============ GET /api/debug/db-check - 数据库连接诊断 ============
// 用于排查 Vercel / Cloudflare Workers 部署环境中的数据库连接问题
export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    runtime: typeof process !== 'undefined' ? 'node' : 'unknown',
    nodeVersion: typeof process !== 'undefined' ? process.version : 'N/A',
  };

  // 1. 检查环境变量
  const dbUrl = process.env.DATABASE_URL || '';
  const dbAuthToken = process.env.DATABASE_AUTH_TOKEN || '';

  diagnostics.env = {
    DATABASE_URL: dbUrl
      ? `${dbUrl.substring(0, 30)}...${dbUrl.substring(dbUrl.length - 20)}`
      : 'NOT SET',
    DATABASE_AUTH_TOKEN: dbAuthToken
      ? `SET (length: ${dbAuthToken.length})`
      : 'NOT SET',
    JWT_SECRET: process.env.JWT_SECRET
      ? `SET (length: ${process.env.JWT_SECRET.length})`
      : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'N/A',
  };

  if (!dbUrl) {
    diagnostics.error = 'DATABASE_URL 未设置，请在平台环境变量中配置';
    return NextResponse.json(diagnostics, { status: 500 });
  }

  // 2. 尝试获取数据库客户端
  let db;
  try {
    db = getDb();
  } catch (error) {
    diagnostics.status = 'CLIENT_ERROR';
    diagnostics.error = error instanceof Error ? error.message : String(error);
    return NextResponse.json(diagnostics, { status: 500 });
  }

  // 3. 执行测试查询（使用 queryWithTimeout 和其他 API 一致的方式）
  const TIMEOUT = 8000;

  try {
    // 测试查询 1: 获取所有表
    const tables = await queryWithTimeout(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      [],
      TIMEOUT,
    );
    diagnostics.tables = (tables as Record<string, unknown>[]).map((r) => r.name);

    // 测试查询 2: 各表数据量
    const tableCounts: Record<string, number> = {};
    for (const table of diagnostics.tables as string[]) {
      const rows = await queryWithTimeout(
        db,
        `SELECT COUNT(*) as count FROM ${table}`,
        [],
        TIMEOUT,
      );
      tableCounts[table] = Number((rows as Record<string, unknown>[])[0]?.count) || -1;
    }
    diagnostics.tableCounts = tableCounts;

    // 测试查询 3: 已发布帖子
    const posts = await queryWithTimeout(
      db,
      "SELECT id, title, status FROM Post WHERE status = 'PUBLISHED' ORDER BY created_at DESC LIMIT 5",
      [],
      TIMEOUT,
    );
    diagnostics.recentPosts = posts;

    // 测试查询 4: 分类
    const cats = await queryWithTimeout(
      db,
      'SELECT id, name, slug FROM Category ORDER BY sort_order ASC',
      [],
      TIMEOUT,
    );
    diagnostics.categories = cats;

    // 测试查询 5: 标签
    const tags = await queryWithTimeout(
      db,
      'SELECT id, name, slug, post_count FROM Tag ORDER BY post_count DESC LIMIT 10',
      [],
      TIMEOUT,
    );
    diagnostics.tags = tags;

    diagnostics.status = 'OK';
    diagnostics.message = '数据库连接正常，查询成功';
  } catch (error) {
    diagnostics.status = 'QUERY_ERROR';
    diagnostics.error = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(diagnostics, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
