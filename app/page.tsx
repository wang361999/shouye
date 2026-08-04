import type { Metadata } from 'next';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';
import CommunityHomeClient from '@/components/home/CommunityHomeClient';
import MobileHomeClient from '@/components/home/MobileHomeClient';

// 首页 ISR 缓存 10 分钟，大幅减少 SSR CPU 消耗
// 站点设置变更后可通过 revalidatePath 主动刷新
export const revalidate = 600;

const DEFAULT_SITE_NAME = 'Gitd';
const DEFAULT_SITE_DESC = '开发者交流社区';

function isMobileRequest() {
  const requestHeaders = headers();
  const userAgent = requestHeaders.get('user-agent') || '';
  const mobileHint = requestHeaders.get('sec-ch-ua-mobile') || '';

  if (mobileHint === '?1') return true;
  return /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
}

/**
 * 带超时的站点设置查询（3 秒超时，降级返回默认值）
 */
async function getSiteSettings() {
  let siteName = DEFAULT_SITE_NAME;
  let siteDescription = DEFAULT_SITE_DESC;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const settings = await Promise.race([
      prisma.systemSetting.findMany({
        where: { key: { in: ['site_name', 'site_description'] } },
      }),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () =>
          reject(new Error('timeout')),
        ),
      ),
    ]);
    clearTimeout(timeout);
    for (const s of settings) {
      if (s.key === 'site_name' && s.value) siteName = s.value;
      if (s.key === 'site_description' && s.value) siteDescription = s.value;
    }
  } catch {
    // 数据库不可用时降级使用默认值
  }

  return { siteName, siteDescription };
}

export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteDescription } = await getSiteSettings();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://et-studio.vercel.app';

  const title = `${siteName} - ${siteDescription}`;

  return {
    title,
    description: `${siteDescription}。技术交流、工具分享、开源协作、AI 辅助开发，连接开发者共建工具生态。`,
    keywords: [siteName, '开发者社区', '技术交流', '开源项目', '代码分享', '在线工具', 'AI开发', '开发者协作平台', '开发者工具'],
    alternates: {
      canonical: '/',
    },
    openGraph: {
      title,
      description: siteDescription,
      type: 'website',
      locale: 'zh_CN',
      siteName,
      url: baseUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title,
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
  const { siteName, siteDescription } = await getSiteSettings();
  const isMobile = isMobileRequest();

  if (isMobile) {
    return <MobileHomeClient siteName={siteName} siteDesc={siteDescription} />;
  }

  return <CommunityHomeClient siteName={siteName} siteDesc={siteDescription} />;
}
