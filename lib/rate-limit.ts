/**
 * 限流器 - 支持 Vercel KV (Redis) 和内存降级
 *
 * 生产环境配置 KV_REST_API_URL 和 KV_REST_API_TOKEN 环境变量后自动启用分布式限流。
 * 未配置时降级为内存限流（每个 Serverless 实例独立计数，精度较低但仍有防护作用）。
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// ---- 内存限流（降级方案） ----
const limitMap = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL = 60_000; // 1分钟
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of limitMap) {
    if (entry.resetTime < now) {
      limitMap.delete(key);
    }
  }
}

function memoryRateLimit(
  identifier: string,
  limit: number,
  windowMs: number = 60_000,
): { success: boolean; remaining: number; resetAt: number } {
  cleanup();
  const now = Date.now();
  const entry = limitMap.get(identifier);

  if (!entry || entry.resetTime < now) {
    limitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetTime };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetTime };
}

// ---- Vercel KV (Redis) 限流 ----
async function kvRateLimit(
  identifier: string,
  limit: number,
  windowMs: number = 60_000,
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const resetAt = now + windowMs;

  try {
    // 使用 Vercel KV REST API 实现滑动窗口限流
    const response = await fetch(
      `${process.env.KV_REST_API_URL}/incr/${key}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        },
      }
    );

    if (!response.ok) throw new Error('KV request failed');

    const data = await response.json();
    const count = parseInt(data.value, 10);

    // 第一次访问时设置过期时间
    if (count === 1) {
      await fetch(
        `${process.env.KV_REST_API_URL}/expire/${key}/${Math.ceil(windowMs / 1000)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          },
        }
      );
    }

    if (count > limit) {
      return { success: false, remaining: 0, resetAt };
    }

    return { success: true, remaining: limit - count, resetAt };
  } catch {
    // KV 不可用时降级为内存限流
    return memoryRateLimit(identifier, limit, windowMs);
  }
}

/**
 * 检查是否启用了 Vercel KV
 */
const useKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

/**
 * 限流检查
 * @param identifier 唯一标识（如 IP + 路由）
 * @param limit 时间窗口内最大请求数
 * @param windowMs 时间窗口（毫秒）
 * @returns { success: boolean; remaining: number; resetAt: number }
 */
export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number = 60_000,
): { success: boolean; remaining: number; resetAt: number } {
  return memoryRateLimit(identifier, limit, windowMs);
}

/**
 * 异步限流检查（支持 Vercel KV 分布式限流）
 * 推荐在 API 路由中使用此函数
 */
export async function rateLimitAsync(
  identifier: string,
  limit: number,
  windowMs: number = 60_000,
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  if (useKV) {
    return kvRateLimit(identifier, limit, windowMs);
  }
  return memoryRateLimit(identifier, limit, windowMs);
}

/**
 * 获取客户端 IP
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP;
  return 'unknown';
}

/**
 * 创建限流响应头
 */
export function rateLimitHeaders(result: { remaining: number; resetAt: number }) {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}
