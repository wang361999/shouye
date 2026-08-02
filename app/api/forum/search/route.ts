import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ============ GET /api/forum/search - 论坛增强搜索 ============
// 参数: ?q=关键词&page=1&limit=20&type=post|comment|all
// 搜索帖子：标题 + 内容 + 标签名
// 搜索评论：内容
// 返回结果高亮关键词（在匹配位置添加 <mark> 标签），按相关度排序（标题匹配优先于内容匹配）
// 返回: { results: [...], total, page, totalPages }

/** 转义正则特殊字符，用于安全地把关键词拼进正则 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 在文本匹配位置添加 <mark> 标签（大小写不敏感） */
function highlight(text: string, q: string): string {
  if (!text || !q) return text || '';
  const re = new RegExp(`(${escapeRegExp(q)})`, 'gi');
  return text.replace(re, '<mark>$1</mark>');
}

/** 从文本中截取一段包含关键词的摘要（找不到关键词则从头截取） */
function makeSnippet(text: string, q: string, maxLen = 200): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) {
    return text.substring(0, maxLen) + '...';
  }
  const half = Math.floor((maxLen - q.length) / 2);
  let start = Math.max(0, idx - half);
  const end = Math.min(text.length, start + maxLen);
  // 若 end 触底，回推 start 以保证片段长度
  start = Math.max(0, end - maxLen);
  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const rawType = (searchParams.get('type') || 'all').toLowerCase();
    const type = ['post', 'comment', 'all'].includes(rawType) ? rawType : 'all';

    // ---- 关键词为空时返回空结果 ----
    if (!q) {
      return NextResponse.json({
        results: [],
        total: 0,
        page,
        totalPages: 0,
        q: '',
      });
    }

    const searchPosts = type === 'all' || type === 'post';
    const searchComments = type === 'all' || type === 'comment';

    type ResultItem = {
      type: 'post' | 'comment';
      id: string;
      score: number;
      createdAt: string;
      [key: string]: unknown;
    };

    const results: ResultItem[] = [];

    // ---- 帖子搜索：标题 + 内容 + 标签名 ----
    if (searchPosts) {
      const postWhere = {
        status: 'PUBLISHED' as const,
        deletedAt: null,
        OR: [
          { title: { contains: q } },
          { content: { contains: q } },
          { tags: { some: { tag: { name: { contains: q } } } } },
        ],
      };

      const postRows = await prisma.post.findMany({
        where: postWhere,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          content: true,
          postType: true,
          createdAt: true,
          authorName: true,
          author: { select: { id: true, username: true, avatar: true } },
          category: { select: { id: true, name: true, slug: true } },
          tags: {
            include: {
              tag: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });

      const lowerQ = q.toLowerCase();
      for (const p of postRows) {
        // 相关度评分：标题匹配 100，标签名匹配 50，内容匹配 10
        let score = 0;
        if (p.title.toLowerCase().includes(lowerQ)) score += 100;
        if (p.tags.some((pt) => pt.tag.name.toLowerCase().includes(lowerQ))) score += 50;
        if (p.content.toLowerCase().includes(lowerQ)) score += 10;

        const snippet = makeSnippet(p.content, q, 200);
        results.push({
          type: 'post',
          id: p.id,
          score,
          createdAt: p.createdAt.toISOString(),
          title: p.title,
          highlightedTitle: highlight(p.title, q),
          content: snippet,
          highlightedContent: highlight(snippet, q),
          postType: p.postType,
          author: p.author
            ? { id: p.author.id, username: p.authorName || p.author.username, avatar: p.author.avatar }
            : null,
          category: p.category
            ? { id: p.category.id, name: p.category.name, slug: p.category.slug }
            : null,
          tags: p.tags.map((pt) => ({
            id: pt.tag.id,
            name: pt.tag.name,
            slug: pt.tag.slug,
          })),
        });
      }
    }

    // ---- 评论搜索：内容 ----
    if (searchComments) {
      const commentWhere = {
        deletedAt: null,
        content: { contains: q },
        // 仅搜索未删除、已发布帖子下的评论
        post: { status: 'PUBLISHED' as const, deletedAt: null },
      };

      const commentRows = await prisma.comment.findMany({
        where: commentWhere,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          createdAt: true,
          postId: true,
          author: { select: { id: true, username: true, avatar: true } },
          post: { select: { id: true, title: true } },
        },
      });

      for (const c of commentRows) {
        // 评论仅内容匹配，评分 10
        const snippet = makeSnippet(c.content, q, 200);
        results.push({
          type: 'comment',
          id: c.id,
          score: 10,
          createdAt: c.createdAt.toISOString(),
          content: snippet,
          highlightedContent: highlight(snippet, q),
          postId: c.postId,
          postTitle: c.post?.title || null,
          author: c.author
            ? { id: c.author.id, username: c.author.username, avatar: c.author.avatar }
            : null,
        });
      }
    }

    // ---- 按相关度排序（标题匹配优先于内容匹配），同分按时间倒序 ----
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.createdAt.localeCompare(a.createdAt);
    });

    const total = results.length;
    const totalPages = Math.ceil(total / limit) || 0;
    const paged = results.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      results: paged,
      total,
      page,
      totalPages,
      q,
    });
  } catch (error) {
    console.error('[FORUM SEARCH ERROR]', error);
    return NextResponse.json(
      { error: '搜索失败，请稍后重试' },
      { status: 500 },
    );
  }
}
