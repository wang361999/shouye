import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { Toaster } from 'react-hot-toast';
import prisma from '@/lib/prisma';

// ============ 默认站点信息 ============
const DEFAULT_SITE_NAME = 'ET Studio';
const DEFAULT_SITE_DESC = '开发者工具与社区';

/**
 * generateMetadata - 服务端动态生成页面元数据
 * 从数据库读取网站名称和描述，使后台修改后全站标题立即生效
 */
export async function generateMetadata(): Promise<Metadata> {
  let siteName = DEFAULT_SITE_NAME;
  let siteDescription = DEFAULT_SITE_DESC;
  let siteFavicon = '';

  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: ['site_name', 'site_description', 'site_favicon'] },
      },
    });
    for (const s of settings) {
      if (s.key === 'site_name' && s.value) siteName = s.value;
      if (s.key === 'site_description' && s.value) siteDescription = s.value;
      if (s.key === 'site_favicon' && s.value) siteFavicon = s.value;
    }
  } catch {
    // 数据库不可用时降级使用默认值
  }

  const icons = siteFavicon
    ? { icon: siteFavicon, shortcut: siteFavicon }
    : undefined;

  return {
    title: `${siteName} - ${siteDescription}`,
    description: siteDescription,
    keywords: [siteName, '开发者工具', 'GitHub', 'AI', '技术社区'],
    icons,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
