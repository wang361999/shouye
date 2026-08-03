/**
 * Sentry 服务端配置
 *
 * 覆盖 Node.js Runtime（API 路由、Server Components）。
 * 仅在 SENTRY_DSN 配置时生效。
 */
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  enabled: process.env.NODE_ENV === 'production' && !!SENTRY_DSN,

  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-api-key'];
    }
    return event;
  },
});
