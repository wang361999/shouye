import prisma from '@/lib/prisma';
import HomePageClient from '@/components/home/HomePageClient';

const DEFAULT_SITE_NAME = 'ET Studio';
const DEFAULT_SITE_DESC = '开发者工具与社区';

/**
 * 首页 - 服务端组件
 * 从数据库获取站点设置，传递给客户端组件，避免首屏闪烁旧名称
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

  return <HomePageClient siteName={siteName} siteDesc={siteDescription} />;
}
