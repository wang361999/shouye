import { NextRequest, NextResponse } from 'next/server';
import { getDb, queryWithTimeout } from '@/lib/db';
import { checkDbOr503 } from '@/lib/db-check';

// ============ GET /api/forum/search - 论坛增强搜索 ============
// 参数: ?q=关键词&page=1&limit=20&type=post|comment|all
// 搜索帖子：标题 + 内容 + 标签名
// 搜索评论：内容
// 返回结果高亮关键词（在匹配位置添加 <mark> 标签），按相关度排序（标题匹配优先于内容匹配）
// 返回: { results: [...], total, page, totalPages }
// 使用原生 SQL 替代 Prisma，提升 Cloudflare Workers 性能

const QUERY_TIMEOUT = 6000;

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

    let db;
    const dbError = checkDbOr503();
    if (dbError) return dbError;
    try {
      db = getDb();
    } catch {
      return NextResponse.json({
        results: [],
        total: 0,
        page,
        totalPages: 0,
        q,
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
      const postRows = await queryWithTimeout(
        db,
        `SELECT p.id, p.title, p.content, p.post_type, p.created_at, p.author_name,
                u.id as author_id, u.username as author_username, u.avatar as author_avatar,
                c.id as cat_id, c.name as cat_name, c.slug as cat_slug
         FROM Post p
         LEFT JOIN User u ON p.author_id = u.id
         LEFT JOIN Category c ON p.category_id = c.id
         WHERE p.status = 'PUBLISHED' AND p.deleted_at IS NULL
           AND (p.title LIKE '%' || ? || '%' OR p.content LIKE '%' || ? || '%'
                OR EXISTS (SELECT 1 FROM PostTag pt JOIN Tag t ON pt.tag_id = t.id
                           WHERE pt.post_id = p.id AND t.name LIKE '%' || ? || '%'))
         ORDER BY p.created_at DESC`,
        [q, q, q],
        QUERY_TIMEOUT,
      );

      const posts = postRows as Record<string, unknown>[];

      // 查询匹配帖子的标签（用于相关度评分）
      let tagsMap: Map<string, Array<{ id: string; name: string; slug: string }>> = new Map();
      if (posts.length > 0) {
        const postIds = posts.map((p) => p.id as string);
        const placeholders = postIds.map(() => '?').join(',');
        const tagRows = await queryWithTimeout(
          db,
          `SELECT pt.post_id, t.id as tag_id, t.name as tag_name, t.slug as tag_slug
           FROM PostTag pt
           JOIN Tag t ON pt.tag_id = t.id
           WHERE pt.post_id IN (${placeholders})`,
          postIds,
          QUERY_TIMEOUT,
        );

        tagsMap = new Map();
        for (const row of tagRows as Record<string, unknown>[]) {
          const pid = row.post_id as string;
          if (!tagsMap.has(pid)) tagsMap.set(pid, []);
          tagsMap.get(pid)!.push({
            id: row.tag_id as string,
            name: row.tag_name as string,
            slug: row.tag_slug as string,
          });
        }
      }

      const lowerQ = q.toLowerCase();
      for (const p of posts) {
        const postTags = tagsMap.get(p.id as string) || [];
        const titleStr = (p.title as string) || '';
        const contentStr = (p.content as string) || '';

        // 相关度评分：标题匹配 100，标签名匹配 50，内容匹配 10
        let score = 0;
        if (titleStr.toLowerCase().includes(lowerQ)) score += 100;
        if (postTags.some((t) => t.name.toLowerCase().includes(lowerQ))) score += 50;
        if (contentStr.toLowerCase().includes(lowerQ)) score += 10;

        const snippet = makeSnippet(contentStr, q, 200);
        const authorName = p.author_name as string | null;
        results.push({
          type: 'post',
          id: p.id as string,
          score,
          createdAt: p.created_at as string,
          title: titleStr,
          highlightedTitle: highlight(titleStr, q),
          content: snippet,
          highlightedContent: highlight(snippet, q),
          postType: p.post_type,
          author: p.author_id
            ? {
                id: p.author_id,
                username: authorName || p.author_username || '匿名',
                avatar: p.author_avatar,
              }
            : null,
          category: p.cat_id
            ? { id: p.cat_id, name: p.cat_name, slug: p.cat_slug }
            : null,
          tags: postTags,
        });
      }
    }

    // ---- 评论搜索：内容 ----
    if (searchComments) {
      const commentRows = await queryWithTimeout(
        db,
        `SELECT cm.id, cm.content, cm.created_at, cm.post_id,
                u.id as author_id, u.username as author_username, u.avatar as author_avatar,
                p.id as post_id, p.title as post_title
         FROM Comment cm
         LEFT JOIN User u ON cm.author_id = u.id
         JOIN Post p ON cm.post_id = p.id
         WHERE cm.deleted_at IS NULL
           AND cm.content LIKE '%' || ? || '%'
           AND p.status = 'PUBLISHED' AND p.deleted_at IS NULL
         ORDER BY cm.created_at DESC`,
        [q],
        QUERY_TIMEOUT,
      );

      for (const c of commentRows as Record<string, unknown>[]) {
        const contentStr = (c.content as string) || '';
        const snippet = makeSnippet(contentStr, q, 200);
        results.push({
          type: 'comment',
          id: c.id as string,
          score: 10,
          createdAt: c.created_at as string,
          content: snippet,
          highlightedContent: highlight(snippet, q),
          postId: c.post_id,
          postTitle: c.post_title || null,
          author: c.author_id
            ? {
                id: c.author_id,
                username: c.author_username || '匿名',
                avatar: c.author_avatar,
              }
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
