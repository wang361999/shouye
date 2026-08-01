import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// 缓存 GET 响应 1 小时（产品数据不频繁变化）
export const revalidate = 3600;

/**
 * GET /api/products - 公开接口，获取所有上架产品列表（无需鉴权）
 * 返回精简字段，features 字段从 JSON 字符串解析为数组
 * 排序：sortOrder 降序 → createdAt 降序
 */
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'active' },
      orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
    });

    const result = products.map((p) => {
      // 解析 features JSON 字符串为数组
      let features: string[] = [];
      if (p.features) {
        try {
          const parsed = JSON.parse(p.features);
          if (Array.isArray(parsed)) {
            features = parsed.filter((f) => typeof f === 'string');
          }
        } catch {
          // 解析失败则保留空数组
          features = [];
        }
      }

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        tagline: p.tagline,
        icon: p.icon,
        coverImage: p.coverImage,
        features,
        demoUrl: p.demoUrl,
        priceBasic: p.priceBasic,
        priceStandard: p.priceStandard,
        pricePremium: p.pricePremium,
        priceEnterprise: p.priceEnterprise,
        validDays: p.validDays,
        sortOrder: p.sortOrder,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PRODUCTS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取产品列表失败' },
      { status: 500 },
    );
  }
}
