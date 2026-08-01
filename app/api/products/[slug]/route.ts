import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/products/[slug] - 公开接口，根据 slug 获取产品详情（无需鉴权）
 * 包含最新版本（isLatest=true, isPublished=true）以及所有已发布版本
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const { slug } = params;

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        versions: {
          where: { isPublished: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product || product.status !== 'active') {
      return NextResponse.json(
        { error: '产品不存在或已下架' },
        { status: 404 },
      );
    }

    // 解析 features JSON 字符串为数组
    let features: string[] = [];
    if (product.features) {
      try {
        const parsed = JSON.parse(product.features);
        if (Array.isArray(parsed)) {
          features = parsed.filter((f) => typeof f === 'string');
        }
      } catch {
        features = [];
      }
    }

    // 找出最新版本（isLatest=true 且已发布）
    const latestVersion =
      product.versions.find((v) => v.isLatest && v.isPublished) || null;

    const result = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      tagline: product.tagline,
      description: product.description,
      icon: product.icon,
      coverImage: product.coverImage,
      features,
      techStack: product.techStack,
      screenshots: product.screenshots,
      demoUrl: product.demoUrl,
      docsUrl: product.docsUrl,
      status: product.status,
      sortOrder: product.sortOrder,
      downloadUrl: product.downloadUrl,
      priceBasic: product.priceBasic,
      priceStandard: product.priceStandard,
      pricePremium: product.pricePremium,
      priceEnterprise: product.priceEnterprise,
      validDays: product.validDays,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      latestVersion: latestVersion
        ? {
            id: latestVersion.id,
            version: latestVersion.version,
            title: latestVersion.title,
            changelog: latestVersion.changelog,
            downloadUrl: latestVersion.downloadUrl,
            fileSize: latestVersion.fileSize,
            isLatest: latestVersion.isLatest,
            isPublished: latestVersion.isPublished,
            createdAt: latestVersion.createdAt,
          }
        : null,
      versions: product.versions.map((v) => ({
        id: v.id,
        version: v.version,
        title: v.title,
        changelog: v.changelog,
        downloadUrl: v.downloadUrl,
        fileSize: v.fileSize,
        isLatest: v.isLatest,
        isPublished: v.isPublished,
        createdAt: v.createdAt,
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PRODUCT DETAIL ERROR]', error);
    return NextResponse.json(
      { error: '获取产品详情失败' },
      { status: 500 },
    );
  }
}
