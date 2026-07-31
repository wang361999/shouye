import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ============ 公开系统设置默认值 ============
const DEFAULT_SETTINGS = {
  site_name: 'ET Studio',
  site_description: '开发者工具与社区',
  site_logo: '',
  site_favicon: '',
};

// ============ GET /api/settings - 公开接口（无需鉴权） ============
// 仅返回前端展示所需的站点信息：site_name, site_description, site_logo, site_favicon
export async function GET() {
  try {
    // 从数据库读取需要的 key
    const keys = ['site_name', 'site_description', 'site_logo', 'site_favicon'];
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    });

    // 组织成对象
    const settingsObj: Record<string, string> = {};
    for (const item of settings) {
      settingsObj[item.key] = item.value;
    }

    // 合并默认值（数据库未设置时降级）
    return NextResponse.json({
      site_name: settingsObj.site_name || DEFAULT_SETTINGS.site_name,
      site_description:
        settingsObj.site_description || DEFAULT_SETTINGS.site_description,
      site_logo: settingsObj.site_logo ?? DEFAULT_SETTINGS.site_logo,
      site_favicon: settingsObj.site_favicon ?? DEFAULT_SETTINGS.site_favicon,
    });
  } catch (error) {
    // 数据库不可用时降级返回默认值
    console.error('[PUBLIC SETTINGS GET ERROR]', error);
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}
