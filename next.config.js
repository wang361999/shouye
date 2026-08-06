const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ============ 性能优化 ============
  // 隐藏 X-Powered-By 头（安全）
  poweredByHeader: false,
  // 启用 gzip 压缩
  compress: true,
  // 转译需要转译的第三方包
  transpilePackages: ['react-markdown', 'remark-gfm', 'remark-parse', 'remark-rehype', 'unified', 'micromark', 'mdast', 'rehype'],

  // ============ 安全头 ============
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 防止 MIME 类型嗅探
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // 防止点击劫持
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // XSS 保护
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Referrer 策略 - 只发送 origin
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 权限策略 - 禁用不需要的浏览器功能
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // 内容安全策略
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https:",
              "media-src 'self'",
              "object-src 'none'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      // 静态资源缓存 - 长期缓存
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // 图片优化缓存
      {
        source: '/_next/image(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, s-maxage=2592000' },
        ],
      },
    ];
  },

  // ============ 图片优化 ============
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24小时
    // 允许外部头像域名（支持常见头像服务和任意 https 图片）
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },

  // ============ ESLint ============
  // 构建时不因 ESLint 警告/错误中断
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ============ 实验性功能 ============
  experimental: {
    // 优化 Server Components 序列化（仅优化已安装的包）
    optimizePackageImports: ['date-fns'],
  },
};

// ============ Sentry 配置 ============
module.exports = withSentryConfig(
  nextConfig,
  {
    // 仅在生产构建时上传 Source Map
    // 未配置 SENTRY_AUTH_TOKEN 时自动跳过上传
    silent: true,

    // 禁用构建时自动创建 release（需要 SENTRY_AUTH_TOKEN）
    autoInstrumentServerFunctions: true,

    // 隐藏 Sentry 构建日志（非关键信息）
    hideSourceMaps: true,

    // 禁用 webpack treeshaking 警告
    disableLogger: true,
  },
);
