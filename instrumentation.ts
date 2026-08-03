/**
 * Next.js Instrumentation Hook
 *
 * Next.js 14 自动调用此文件中的 register() 函数：
 * - 服务端：在 Node.js Runtime 启动时调用
 * - Edge 端：在 Edge Runtime 启动时调用
 *
 * 用于延迟加载 Sentry 配置，避免在构建阶段执行。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
