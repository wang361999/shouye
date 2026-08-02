/**
 * 数据库配置检查工具
 *
 * 从 lib/db.ts 分离出来，避免在数据库工具文件中导入 next/server，
 * 防止 Cloudflare Workers (OpenNext) 打包时 @libsql/client 解析失败。
 */
import { NextResponse } from 'next/server';

/**
 * 检查数据库环境变量是否已配置
 */
export function isDbConfigured(): boolean {
  return !!(process.env.DATABASE_URL && process.env.DATABASE_AUTH_TOKEN);
}

/**
 * 检查数据库配置，返回 503 错误响应或 null
 *
 * 在 API 路由开头调用：
 *   const err = checkDbOr503();
 *   if (err) return err;
 *   const db = getDb();
 *
 * 这样部署环境缺少环境变量时，用户能看到明确错误而非空白页面
 */
export function checkDbOr503(): NextResponse | null {
  const url = process.env.DATABASE_URL || '';
  const authToken = process.env.DATABASE_AUTH_TOKEN || '';

  if (!url || !authToken) {
    const missing: string[] = [];
    if (!url) missing.push('DATABASE_URL');
    if (!authToken) missing.push('DATABASE_AUTH_TOKEN');

    console.error('[DB CONFIG ERROR] Missing env vars:', missing.join(', '));

    return NextResponse.json(
      {
        error: '数据库未配置',
        detail: `缺少环境变量: ${missing.join(', ')}`,
        hint: '请在 Vercel Dashboard → Settings → Environment Variables 或 Cloudflare Workers → Settings → Variables 中配置',
        runtime: typeof process !== 'undefined' ? process.version : 'unknown',
        nodeEnv: process.env.NODE_ENV || 'unknown',
      },
      { status: 503 },
    );
  }

  return null;
}
