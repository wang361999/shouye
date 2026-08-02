import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import CommunityHomeClient from '@/components/home/CommunityHomeClient';

const DEFAULT_SITE_NAME = 'Gitd';
const DEFAULT_SITE_DESC = '开发者交流社区';

export async function generateMetadata(): Promise<Metadata> {
  let siteName = DEFAULT_SITE_NAME;
  let siteDescription = DEFAULT_SITE_DESC;

  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: ['site_name', 'site_description'] },
      },
    });
    for (const s of settings) {
      if (s.key === 'site_name' && s.value) siteName = s.value;
      if (s.key === 'site_description' && s.value) siteDescription = s.value;
    }
  } catch {
    // 数据库不可用时降级使用默认值
  }

  const title = '首页';

  return {
    title,
    description: siteDescription,
    keywords: [siteName, '开发者社区', '技术交流', '开源项目', '代码分享'],
    openGraph: {
      title: `首页 | ${siteName}`,
      description: siteDescription,
      type: 'website',
      locale: 'zh_CN',
      siteName,
    },
    twitter: {
      card: 'summary_large_image',
      title: `首页 | ${siteName}`,
      description: siteDescription,
    },
  };
}

/**
 * 首页 - 社区型主页（服务端组件）
 * 从数据库获取站点设置，传递给社区客户端组件
 * 社区数据由前端通过 /api/community/home 获取
 */
export default async function HomePage() {
  let siteName = DEFAULT_SITE_NAME;
  let siteDescription = DEFAULT_SITE_DESC;

  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: ['site_name', 'site_description'] },
      },
    });
    for (const s of settings) {
      if (s.key === 'site_name' && s.value) siteName = s.value;
      if (s.key === 'site_description' && s.value) siteDescription = s.value;
    }
  } catch {
    // 数据库不可用时降级使用默认值
  }

  return <CommunityHomeClient siteName={siteName} siteDesc={siteDescription} />;
}
