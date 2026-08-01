import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 全局中间件 - 安全头 + 请求追踪
 *
 * 1. 为所有响应注入安全头
 * 2. 请求追踪（使用 fetch keepalive 确保追踪请求在响应返回后仍能完成）
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

  // 判断是否为 API 路由
  const isApi = pathname.startsWith('/api/');

  // 使用 fetch keepalive 发送追踪请求
  // keepalive 选项确保请求在页面/中间件卸载后仍能完成
  // 这是浏览器和 Edge Runtime 标准的 beacon 发送方式
  try {
    const trackUrl = new URL('/api/_monitor/track', request.url);
    fetch(trackUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Track': '1',
      },
      body: JSON.stringify({
        path: pathname,
        method: request.method,
        isApi,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 忽略追踪错误，不影响正常请求
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
