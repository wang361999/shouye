import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ============ XML 字符转义 ============
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============ GET /api/forum/rss - RSS 订阅 ============
// 返回 RSS XML，支持 ?category=xxx 按分类筛选，返回最新 20 条已发布帖子
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get('category') || undefined;

    // ---- 构建查询条件 ----
    const where: Record<string, unknown> = {
      status: 'PUBLISHED',
    };

    let categoryName = '全部';

    if (categorySlug) {
      const category = await prisma.category.findUnique({
        where: { slug: categorySlug },
      });
      if (category) {
        where.categoryId = category.id;
        categoryName = category.name;
      }
    }

    // ---- 查询最新 20 条已发布帖子 ----
    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        author: {
          select: { username: true },
        },
        category: {
          select: { name: true, slug: true },
        },
      },
    });

    // ---- 站点信息 ----
    const siteTitle = categorySlug
      ? `${categoryName} - 论坛`
      : '论坛最新帖子';
    const siteDesc = categorySlug
      ? `${categoryName} 分类的最新帖子`
      : '论坛最新发布的帖子';
    const siteLink = '/forum';

    // ---- 构建 RSS XML ----
    const itemsXml = posts
      .map((post) => {
        const postUrl = `/forum/post/${post.id}`;
        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="false">${escapeXml(post.id)}</guid>
      <pubDate>${post.createdAt.toUTCString()}</pubDate>
      <author>${escapeXml(post.author.username)}</author>${
          post.category
            ? `\n      <category>${escapeXml(post.category.name)}</category>`
            : ''
        }
      <description><![CDATA[${post.content}]]></description>
    </item>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(siteTitle)}</title>
    <link>${escapeXml(siteLink)}</link>
    <description>${escapeXml(siteDesc)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Next.js Forum RSS</generator>
${itemsXml}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (error) {
    console.error('[RSS ERROR]', error);
    return NextResponse.json(
      { error: '生成 RSS 失败' },
      { status: 500 }
    );
  }
}
