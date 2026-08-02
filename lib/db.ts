/**
 * 共享 libsql 客户端（直接 SQL 查询，跳过 Prisma ORM 开销）
 *
 * 用于高频 API 路由，比 Prisma 快 2-3 倍：
 *   - 无 ORM 序列化/反序列化开销
 *   - 无 adapter 中间层
 *   - 可使用 substr() 等数据库原生函数减少传输量
 */

import { createClient, type Client, type InArgs } from '@libsql/client';

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
  } catch {
    return fallback;
  }
}
