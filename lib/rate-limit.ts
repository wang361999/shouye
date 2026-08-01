/**
 * 轻量级内存限流器
 * 基于 Map 实现，无需 Redis，适合 Vercel Serverless 环境
 * 每个 Serverless 实例独立计数，配合多实例可实现大致限流
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const limitMap = new Map<string, RateLimitEntry>();

// 定期清理过期条目，防止内存泄漏
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
  cleanup();

  const now = Date.now();
  const entry = limitMap.get(identifier);

  if (!entry || entry.resetTime < now) {
    // 新窗口
    limitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetTime };
  }

  entry.count++;
  return {
    success: true,
    remaining: limit - entry.count,
    resetAt: entry.resetTime,
  };
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
