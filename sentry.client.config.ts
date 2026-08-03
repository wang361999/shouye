/**
 * Sentry 客户端配置
 *
 * 仅在 SENTRY_DSN 环境变量配置时生效，未配置时为空操作。
 * 环境变量通过 Next.js 构建时注入（NEXT_PUBLIC_SENTRY_DSN）。
 */
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // 采样率：生产环境 10%，开发环境 100%
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 生产环境才上报
  enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,

  // 发送前过滤敏感信息
  beforeSend(event) {
    // 移除可能包含敏感信息的请求头
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-api-key'];
    }
    return event;
  },

  // 忽略常见无害错误
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Network request failed',
    'Failed to fetch',
    'Load failed',
  ],
});
