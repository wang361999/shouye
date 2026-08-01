import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 全局中间件 - 请求追踪
 *
 * 追踪每个请求的：路由、方法、响应时间
 * 通过 fire-and-forget 方式发送到内部追踪 API，不阻塞响应
 */

// 需要跳过追踪的路径
const SKIP_PATHS = [
  '/api/_monitor',    // 追踪 API 自身（避免无限循环）
  '/_next/static',    // 静态资源
  '/_next/image',     // 图片优化
  '/favicon.ico',
  '/robots.txt',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳过不需要追踪的路径
  if (SKIP_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const start = Date.now();

  // 获取响应
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 计算耗时
  const duration = Date.now() - start;

  // 从响应头估算数据传输量
  const contentLength = response.headers.get('content-length');
  const estimatedBytes = contentLength ? parseInt(contentLength, 10) : 0;

  // 判断是否为 API 调用（Serverless Function）
  const isApi = pathname.startsWith('/api/');

  // fire-and-forget 追踪，不阻塞响应
  try {
    const trackUrl = new URL('/api/_monitor/track', request.url);
    fetch(trackUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 内部调用标识，追踪 API 不需要鉴权
        'X-Internal-Track': '1',
      },
      body: JSON.stringify({
        path: pathname,
        method: request.method,
        duration,
        isApi,
        dataBytes: estimatedBytes,
        // 请求来源：用户IP的前3位用于地区统计，不存储完整IP
        statusCode: response.status,
      }),
      keepalive: true,
    }).catch(() => {
      // 静默失败，不影响正常请求
    });
  } catch {
    // 忽略追踪错误
  }

  return response;
}

export const config = {
  // 匹配所有路径
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
