import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

/**
 * 动态生成 sitemap.xml
 * 包含：静态页面、工具详情页、论坛帖子、论坛分类、产品页
 * Next.js 会自动在 /sitemap.xml 暴露此文件
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://et-studio.vercel.app';
  const now = new Date();

  // 静态页面
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/tools`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/forum`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/collab`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/docs`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/products`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/search`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  // 动态页面：工具详情
  let toolRoutes: MetadataRoute.Sitemap = [];
  try {
    const tools = await prisma.tool.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
    });
    toolRoutes = tools.map((t) => ({
      url: `${baseUrl}/tools/${t.id}`,
      lastModified: t.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));
  } catch {
    // 数据库不可用时跳过
  }

  // 动态页面：论坛帖子
  let postRoutes: MetadataRoute.Sitemap = [];
  try {
    const posts = await prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200, // 最近的200篇帖子
    });
    postRoutes = posts.map((p) => ({
      url: `${baseUrl}/forum/post/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {
    // 数据库不可用时跳过
  }

  // 动态页面：论坛分类
  let categoryRoutes: MetadataRoute.Sitemap = [];
  try {
    const categories = await prisma.category.findMany({
      select: { slug: true },
    });
    categoryRoutes = categories
      .filter((c) => c.slug)
      .map((c) => ({
        url: `${baseUrl}/forum/category/${c.slug}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.6,
      }));
  } catch {
    // 数据库不可用时跳过
  }

  // 动态页面：产品详情
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const products = await prisma.product.findMany({
      where: { status: 'active' },
      select: { slug: true, updatedAt: true },
    });
    productRoutes = products.map((p) => ({
      url: `${baseUrl}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));
  } catch {
    // 数据库不可用时跳过
  }

  return [...staticRoutes, ...toolRoutes, ...postRoutes, ...categoryRoutes, ...productRoutes];
}
