import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';

/**
 * 全局中间件 - 安全头 + 请求追踪
 *
 * 1. 为所有响应注入安全头
 * 2. 请求追踪（使用 waitUntil 确保追踪请求不会因响应返回而被提前中断）
 */

// 需要跳过追踪的路径
const SKIP_PATHS = [
  '/api/_monitor',
  '/_next/static',
  '/_next/image',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

// 安全头配置
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
};

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // 跳过静态资源（仍注入安全头）
  if (SKIP_PATHS.some((p) => pathname.startsWith(p))) {
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  }

  // 获取响应
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 注入安全头
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // 隐藏 Server 头
  response.headers.delete('X-Powered-By');

  // 判断是否为 API 路由
  const isApi = pathname.startsWith('/api/');

  // 使用 waitUntil 发送追踪请求。
  // 之前只 fire-and-forget，生产环境里很容易被提前回收，导致监控数据像“假的”。
  try {
    const trackUrl = new URL('/api/_monitor/track', request.url);
    const startedAt = Date.now();
    event.waitUntil(
      fetch(trackUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Track': process.env.MONITOR_INTERNAL_SECRET || '1',
        },
        body: JSON.stringify({
          path: pathname,
          method: request.method,
          isApi,
          duration: Math.max(1, Date.now() - startedAt),
          dataBytes: 0,
        }),
      }).catch(() => undefined),
    );
  } catch {
    // 忽略追踪错误，不影响正常请求
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
