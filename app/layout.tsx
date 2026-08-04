import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import MobileNav from '@/components/common/MobileNav';
import { Toaster } from 'react-hot-toast';
import prisma from '@/lib/prisma';

/**
 * viewport 导出 — 启用 viewport-fit=cover 以支持 iPhone 安全区适配
 * 配合 globals.css 中的 env(safe-area-inset-*) 使用
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

// ============ 默认站点信息 ============
const DEFAULT_SITE_NAME = 'Gitd';
const DEFAULT_SITE_DESC = '开发者工具与社区';

/**
 * 带超时的数据库查询包装
 *
 * Cloudflare Workers 有 CPU 时间限制，如果数据库查询过慢会导致 Worker 挂起。
 * 此函数在 3 秒内未完成时自动降级返回默认值。
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    const result = await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        controller.signal.addEventListener('abort', () =>
          reject(new Error(`Query timed out after ${ms}ms`)),
        ),
      ),
    ]);
    clearTimeout(timeout);
    return result;
  } catch {
    return fallback;
  }
}

// 模块级缓存：同一 Worker 实例内复用站点设置，避免每次请求都查库
let cachedSettings: { siteName: string; siteDescription: string; siteFavicon: string } | null = null;
let cacheExpiry = 0;

/**
 * 从数据库获取站点设置（服务端调用，供 generateMetadata 和 RootLayout 共用）
 *
 * 包含 3 秒超时和模块级缓存：
 * - 首次请求查询数据库，3 秒内未完成则降级使用默认值
 * - 后续请求在 60 秒内复用缓存，避免重复查询
 */
async function getSiteSettings() {
  // 命中缓存直接返回
  const now = Date.now();
  if (cachedSettings && now < cacheExpiry) {
    return cachedSettings;
  }

  let siteName = DEFAULT_SITE_NAME;
  let siteDescription = DEFAULT_SITE_DESC;
  let siteFavicon = '';

  try {
    const settings = await withTimeout(
      prisma.systemSetting.findMany({
        where: {
          key: { in: ['site_name', 'site_description', 'site_favicon'] },
        },
      }),
      3000,
      [],
    );
    for (const s of settings) {
      if (s.key === 'site_name' && s.value) siteName = s.value;
      if (s.key === 'site_description' && s.value) siteDescription = s.value;
      if (s.key === 'site_favicon' && s.value) siteFavicon = s.value;
    }
  } catch {
    // 数据库不可用时降级使用默认值
  }

  const result = { siteName, siteDescription, siteFavicon };
  cachedSettings = result;
  cacheExpiry = now + 60_000; // 缓存 60 秒

  return result;
}

/**
 * generateMetadata - 服务端动态生成页面元数据
 * 从数据库读取网站名称和描述，使后台修改后全站标题立即生效
 */
export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteDescription, siteFavicon } = await getSiteSettings();

  const icons = siteFavicon
    ? { icon: siteFavicon, shortcut: siteFavicon }
    : undefined;

  const defaultTitle = `${siteName} - ${siteDescription}`;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://et-studio.vercel.app';

  return {
    title: {
      template: `%s | ${siteName}`,
      default: defaultTitle,
    },
    description: siteDescription,
    keywords: [siteName, '开发者工具', 'GitHub', 'AI', '技术社区', '开发者社区', '开源项目', '代码分享', '在线工具'],
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: '/',
    },
    icons,
    openGraph: {
      title: defaultTitle,
      description: siteDescription,
      type: 'website',
      locale: 'zh_CN',
      siteName,
      url: baseUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description: siteDescription,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { siteName, siteDescription } = await getSiteSettings();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://et-studio.vercel.app';

  // JSON-LD 结构化数据 — 帮助搜索引擎理解站点
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    description: siteDescription,
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: baseUrl,
    description: siteDescription,
  };

  return (
    <html lang="zh-CN">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-gray-50">
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var saved = localStorage.getItem('theme');
              var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              if (saved === 'dark' || (!saved && prefersDark)) {
                document.documentElement.classList.add('dark');
              }
            } catch(e) {}
          })();
        `}} />
        <Header siteName={siteName} />
        <main className="flex-1 pb-14 md:pb-0">{children}</main>
        <Footer siteName={siteName} />
        <MobileNav />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
