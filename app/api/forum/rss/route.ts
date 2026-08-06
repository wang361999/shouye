import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCategoryDisplayName, normalizeCategorySlug } from '@/lib/utils';

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
// 支持：
//   - 无参数：全部最新帖子
//   - ?category=xxx：按分类筛选
//   - ?tag=xxx：按标签筛选
//   - ?limit=20：自定义数量（最大 50）
// 返回全文 RSS 2.0
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = normalizeCategorySlug(searchParams.get('category') || undefined) || undefined;
    const tagSlug = searchParams.get('tag') || undefined;
    const limitParam = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.min(50, Math.max(5, limitParam));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    // ---- 构建查询条件 ----
    const where: Record<string, unknown> = {
      status: 'PUBLISHED',
      deletedAt: null,
    };

    let feedTitle = '最新帖子';
    let feedDesc = '论坛最新发布的帖子';
    let feedLink = '/forum';

    if (categorySlug) {
      const category = await prisma.category.findUnique({
        where: { slug: categorySlug },
      });
      if (category) {
        where.categoryId = category.id;
        const catName = getCategoryDisplayName(category.name, category.slug);
        feedTitle = `${catName} - 分类帖子`;
        feedDesc = `${catName} 分类的最新帖子`;
        feedLink = `/forum/category/${categorySlug}`;
      }
    }

    if (tagSlug) {
      const tag = await prisma.tag.findUnique({
        where: { slug: tagSlug },
      });
      if (tag) {
        where.tags = {
          some: { tag: { slug: tagSlug } },
        };
        feedTitle = `#${tag.name} - 标签帖子`;
        feedDesc = `标签「${tag.name}」下的最新帖子`;
        feedLink = `/forum?tag=${encodeURIComponent(tagSlug)}`;
      }
    }

    // ---- 查询最新帖子 ----
    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        author: {
          select: { username: true },
        },
        category: {
          select: { name: true, slug: true },
        },
        tags: {
          include: { tag: { select: { name: true, slug: true } } },
        },
      },
    });

    // ---- 站点信息 ----
    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Gitd 社区';
    const fullTitle = `${siteName} · ${feedTitle}`;
    const fullLink = baseUrl + feedLink;

    // ---- 构建 RSS XML ----
    const itemsXml = posts
      .map((post) => {
        const postUrl = baseUrl + `/forum/post/${post.id}`;
        const tagsXml = (post.tags || [])
          .map((t: any) => `      <category>${escapeXml(t.tag.name)}</category>`)
          .join('\n');

        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <pubDate>${post.createdAt.toUTCString()}</pubDate>
      <author>${escapeXml(post.authorName || post.author.username)}</author>
${post.category ? `      <category>${escapeXml(getCategoryDisplayName(post.category.name, post.category.slug))}</category>` : ''}
${tagsXml}
      <description><![CDATA[${post.content}]]></description>
    </item>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(fullTitle)}</title>
    <link>${escapeXml(fullLink)}</link>
    <atom:link href="${escapeXml(baseUrl + '/api/forum/rss' + (categorySlug ? `?category=${categorySlug}` : tagSlug ? `?tag=${tagSlug}` : ''))}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(feedDesc)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Gitd Community RSS</generator>
    <ttl>60</ttl>
${itemsXml}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800',
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
