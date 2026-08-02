/**
 * 共享 libsql 客户端（直接 SQL 查询，跳过 Prisma ORM 开销）
 *
 * 用于高频 API 路由，比 Prisma 快 2-3 倍：
 *   - 无 ORM 序列化/反序列化开销
 *   - 无 adapter 中间层
 *   - 可使用 substr() 等数据库原生函数减少传输量
 *
 * 注意：此文件不导入 next/server，避免 Cloudflare Workers (OpenNext)
 * 打包时 @libsql/client 解析失败。需要 NextResponse 的函数在 lib/db-check.ts 中。
 */

import { createClient, type Client, type InArgs } from '@libsql/client/http';

let client: Client | null = null;

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
 * 带超时的 SQL 查询
 *
 * 超时或查询出错时抛出 Error，由调用方的 try/catch 处理。
 * 这样部署环境的数据库错误能被正确捕获并返回给用户，
 * 而不是静默返回空数据导致"页面正常但无数据"的问题。
 */
export async function queryWithTimeout<T>(
  client: Client,
  sql: string,
  args: InArgs,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    const result = await Promise.race([
      client.execute({ sql, args }),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () =>
          reject(new Error(`Query timed out after ${ms}ms`)),
        ),
      ),
    ]);
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
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
