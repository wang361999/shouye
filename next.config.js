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
    // Cloudflare Workers 上使用 OpenNext 的图片优化
    // 不需要 unoptimized: true，OpenNext 会通过 Cloudflare Images 处理
  },

  // ============ ESLint ============
  // 构建时不因 ESLint 警告/错误中断
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ============ Cloudflare Workers 兼容 ============
  // 这些包包含 workerd 专用代码（条件导出），需要由 OpenNext/esbuild 而非 Next.js 打包
  // 参考: https://opennext.js.org/cloudflare/howtos/workerd
  // nodemailer 和 pg 不在此列表中：它们使用 Function 构造器动态导入，
  // 打包器无法静态解析，因此不会被打包进 Cloudflare Worker（仅在 Vercel/Node.js 可用）
  //
  // 注意：Next.js 14 使用 serverComponentsExternalPackages（非 serverExternalPackages）
  // serverExternalPackages 是 Next.js 15+ 的名称，在 14 中会被忽略并产生警告
  serverComponentsExternalPackages: [
    '@libsql/client',
    '@libsql/isomorphic-ws',
    '@prisma/client',
    '@prisma/adapter-libsql',
    '.prisma/client',
  ],

  // ============ 实验性功能 ============
  experimental: {
    // 优化 Server Components 序列化（仅优化已安装的包）
    optimizePackageImports: ['date-fns'],
  },
};

module.exports = nextConfig;

// ============ Cloudflare OpenNext 本地开发集成 ============
// 在本地开发时启用 Cloudflare 绑定（如 KV、R2 等）
// 仅在开发环境加载，不影响生产构建
if (process.env.NODE_ENV !== 'production') {
  try {
    const { initOpenNextCloudflareForDev } = require('@opennextjs/cloudflare');
    initOpenNextCloudflareForDev();
  } catch {
    // @opennextjs/cloudflare 未安装时静默跳过（不影响纯 Next.js 开发）
  }
}
