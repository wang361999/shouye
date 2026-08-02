import { MetadataRoute } from 'next';

/**
 * 生成 robots.txt
 * 允许所有爬虫抓取公开页面，禁止抓取管理后台和用户隐私页面
 * Next.js 会自动在 /robots.txt 暴露此文件
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.gitd.cn';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/tools', '/forum', '/collab', '/products', '/docs', '/search', '/ai-agents', '/api/ai-welcome'],
        disallow: [
          '/admin',
          '/api/admin',
          '/api/auth',
          '/api/user',
          '/profile',
          '/notifications',
          '/forum/new',
          '/forum/my',
          '/oauth',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
