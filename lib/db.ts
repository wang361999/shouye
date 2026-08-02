/**
 * 共享 libsql 客户端（直接 SQL 查询，跳过 Prisma ORM 开销）
 *
 * 用于高频 API 路由，比 Prisma 快 2-3 倍：
 *   - 无 ORM 序列化/反序列化开销
 *   - 无 adapter 中间层
 *   - 可使用 substr() 等数据库原生函数减少传输量
 *   - batch API 将多条查询合并为单次 HTTP 请求
 */

import { createClient, type Client, type ResultSet, type InStatement, type InArgs } from '@libsql/client';

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
 * 带超时的批量 SQL 查询（单次 HTTP 请求，多语句）
 *
 * libsql batch API 将多条 SELECT 合并为一次网络往返，
 * 对 Turso 等远程数据库可减少 60-80% 的延迟。
 *
 * @param statements SQL 语句数组
 * @param ms 总超时（默认 6 秒）
 * @returns 各语句的行数组，失败时返回 null
 */
export async function batchWithTimeout(
  client: Client,
  statements: InStatement[],
  ms = 6000,
): Promise<ResultSet[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    const results = await Promise.race([
      client.batch(statements),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () =>
          reject(new Error(`Batch timed out after ${ms}ms`)),
        ),
      ),
    ]);
    clearTimeout(timeout);
    return results;
  } catch {
    return null;
  }
}

/**
 * 带超时的单条 SQL 查询（用于独立查询场景）
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
