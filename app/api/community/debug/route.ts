import { NextResponse } from 'next/server';

/**
 * GET /api/community/debug - 诊断 Worker 环境配置
 *
 * 临时调试端点，检查数据库连接和环境变量是否正常。
 */
export async function GET() {
  const hasDbUrl = !!process.env.DATABASE_URL;
  const hasDbToken = !!process.env.DATABASE_AUTH_TOKEN;
  const hasJwtSecret = !!process.env.JWT_SECRET;
  const dbUrlPrefix = process.env.DATABASE_URL?.substring(0, 20) || '(未设置)';

  let dbStatus = '未测试';
  let dbError: string | undefined;

  if (hasDbUrl) {
    try {
      const { createClient } = await import('@libsql/client');
      const client = createClient({
        url: process.env.DATABASE_URL!,
        authToken: process.env.DATABASE_AUTH_TOKEN || '',
      });
      const result = await Promise.race([
        client.execute('SELECT COUNT(*) as cnt FROM Post'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000),
        ),
      ]);
      dbStatus = `连接成功，帖子数: ${(result.rows[0] as Record<string, unknown>)?.cnt || 0}`;
    } catch (err) {
      dbStatus = '连接失败';
      dbError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    env: {
      DATABASE_URL: hasDbUrl ? `${dbUrlPrefix}...` : '❌ 未设置',
      DATABASE_AUTH_TOKEN: hasDbToken ? '✅ 已设置' : '❌ 未设置',
      JWT_SECRET: hasJwtSecret ? '✅ 已设置' : '❌ 未设置',
    },
    database: {
      status: dbStatus,
      error: dbError,
    },
    runtime: {
      platform: typeof process !== 'undefined' ? 'Node.js compat' : 'unknown',
      timestamp: new Date().toISOString(),
    },
  });
}
