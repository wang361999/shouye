import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 全局中间件 - 安全头注入
 *
 * 为所有响应注入安全头。
 * 原请求追踪（waitUntil → /api/_monitor/track）已移除，以降低 Vercel CPU 用量；
 * 如需用量监控请使用 Vercel 后台的 Observability / Web Analytics。
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

export function middleware(request: NextRequest) {
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

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
