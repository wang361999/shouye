/**
 * Sentry Edge Runtime 配置
 *
 * 覆盖 Edge Runtime（middleware.ts、Edge API 路由）。
 * 仅在 SENTRY_DSN 配置时生效。
 */
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,
});
