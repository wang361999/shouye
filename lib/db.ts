/**
 * 共享 libsql 客户端（直接 SQL 查询，跳过 Prisma ORM 开销）
 *
 * 用于高频 API 路由，比 Prisma 快 2-3 倍：
 *   - 无 ORM 序列化/反序列化开销
 *   - 无 adapter 中间层
 *   - 可使用 substr() 等数据库原生函数减少传输量
 */

import { createClient, type Client, type InArgs } from '@libsql/client';
import { NextResponse } from 'next/server';

let client: Client | null = null;

/**
 * 检查数据库环境变量是否已配置
 */
export function isDbConfigured(): boolean {
  return !!(process.env.DATABASE_URL && process.env.DATABASE_AUTH_TOKEN);
}

/**
 * 获取共享 libsql 客户端（惰性初始化，同一 Worker 实例内复用）
 */
export function getDb(): Client {
  if (client) return client;

  const url = process.env.DATABASE_URL || '';
  const authToken = process.env.DATABASE_AUTH_TOKEN || '';

  if (!url) {
    throw new Error('DATABASE_URL 未配置');
  }

  client = createClient({ url, authToken });
  return client;
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

/**
 * 带超时的 SQL 查询
 *
 * Cloudflare Workers 有 CPU 时间限制，数据库查询过慢会导致 Worker 挂起。
 * 超时后降级返回 fallback 值。
 */
export async function queryWithTimeout<T>(
  client: Client,
  sql: string,
  args: InArgs,
  ms: number,
  fallback: T,
): Promise<T> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    const result = await Promise.race([
      client.execute({ sql, args }),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () =>
          reject(new Error(`Query timed out after ${ms}ms`)),
        ),
      ),
    ]);
    clearTimeout(timeout);
    return result.rows as unknown as T;
  } catch (error) {
    // 记录错误信息，方便排查部署环境问题
    console.error('[DB QUERY ERROR]', {
      sql: sql.substring(0, 200),
      error: error instanceof Error ? error.message : String(error),
      hasUrl: !!process.env.DATABASE_URL,
      urlPrefix: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.substring(0, 30)
        : 'NOT SET',
    });
    return fallback;
  }
}
