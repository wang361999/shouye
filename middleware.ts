import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 全局中间件 - 安全头 + 请求追踪
 *
 * 1. 为所有响应注入安全头
 * 2. 轻量级请求追踪（仅 API 路由，fire-and-forget）
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

  // 跳过静态资源
  if (SKIP_PATHS.some((p) => pathname.startsWith(p))) {
    const response = NextResponse.next();
    // 即使是静态资源也注入安全头
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  }

  const start = Date.now();

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

  // 仅追踪 API 路由（减少 Serverless 函数调用开销）
  const isApi = pathname.startsWith('/api/');
  if (!isApi) {
    return response;
  }

  const duration = Date.now() - start;
  const contentLength = response.headers.get('content-length');
  const estimatedBytes = contentLength ? parseInt(contentLength, 10) : 0;

  // fire-and-forget 追踪，不阻塞响应
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
        duration,
        isApi,
        dataBytes: estimatedBytes,
        statusCode: response.status,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // 忽略
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
