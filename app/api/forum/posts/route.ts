import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDb, queryWithTimeout } from '@/lib/db';
import { checkDbOr503 } from '@/lib/db-check';
import type { InValue } from '@libsql/client/http';
import { getUserFromRequest, adminAuth } from '@/lib/auth';
import { revalidateCommunityHome } from '@/lib/revalidate';
import { getCategoryDisplayName, normalizeCategorySlug } from '@/lib/utils';

const QUERY_TIMEOUT = 5000;

// ============ GET /api/forum/posts - 获取帖子列表 ============
// 使用原生 SQL 替代 Prisma，支持分页/搜索/分类/排序/标签/类型过滤
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const categorySlug = normalizeCategorySlug(searchParams.get('category') || undefined) || undefined;
    const search = searchParams.get('search') || undefined;
    const authorId = searchParams.get('authorId') || undefined;
    const statusParam = searchParams.get('status') || undefined;
    const adminFlag = searchParams.get('admin') === '1';
    const sort = searchParams.get('sort') || 'latest';
    const tag = searchParams.get('tag') || undefined;
    const postType = searchParams.get('postType') || undefined;

    // 判断管理员
    const admin = adminAuth(request);
    const isAdmin = !!admin && !(admin instanceof Response) && adminFlag;

    // ---- 动态构建 WHERE 条件 ----
    const conditions: string[] = [];
    const args: InValue[] = [];

    if (!isAdmin) {
      conditions.push("p.status = 'PUBLISHED'");
    } else if (statusParam) {
      conditions.push("p.status = ?");
      args.push(statusParam);
    }

    if (categorySlug) {
      conditions.push("c.slug = ?");
      args.push(categorySlug);
    }

    if (search) {
      // 多关键词搜索：按空格拆分，每个关键词都需匹配（AND 逻辑）
      // 匹配范围：标题、内容、标签名
      const keywords = search.trim().split(/\s+/).filter((kw) => kw.length > 0);

      for (const kw of keywords) {
        conditions.push(
          "(p.title LIKE '%' || ? || '%' OR p.content LIKE '%' || ? || '%' OR EXISTS (SELECT 1 FROM PostTag pt JOIN Tag t ON pt.tag_id = t.id WHERE pt.post_id = p.id AND t.name LIKE '%' || ? || '%'))",
        );
        args.push(kw, kw, kw);
      }
    }

    if (authorId) {
      conditions.push("p.author_id = ?");
      args.push(authorId);
    }

    if (tag) {
      conditions.push("EXISTS (SELECT 1 FROM PostTag pt JOIN Tag t ON pt.tag_id = t.id WHERE pt.post_id = p.id AND (t.slug = ? OR t.name = ?))");
      args.push(tag, tag);
    }

    if (postType) {
      conditions.push("p.post_type = ?");
      args.push(postType);
    }

    if (sort === 'essence') {
      conditions.push("p.is_essence = 1");
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // ---- 排序 ----
    let orderClause: string;
    if (search) {
      // 搜索时按相关性排序：标题匹配优先，然后按热度+时间
      // 仅保留安全字符（字母、数字、中文、空格），防止 SQL 注入
      const safeKeyword = search.trim().split(/\s+/)[0].replace(/[^\w\u4e00-\u9fff\s]/g, '').replace(/'/g, "''");
      if (safeKeyword) {
        orderClause = `p.is_pinned DESC, CASE WHEN p.title LIKE '%' || '${safeKeyword}' || '%' THEN 0 ELSE 1 END, p.like_count DESC, p.created_at DESC`;
      } else {
        orderClause = 'p.is_pinned DESC, p.created_at DESC';
      }
    } else if (sort === 'hot') {
      orderClause = 'p.is_pinned DESC, p.like_count DESC, p.view_count DESC, p.created_at DESC';
    } else {
      orderClause = 'p.is_pinned DESC, p.created_at DESC';
    }

    const offset = (page - 1) * limit;

    const dbError = checkDbOr503();
    if (dbError) return dbError;
    const db = getDb();

    // 热门帖子模式：不需要总数，直接查列表，减少一次数据库查询
    const skipCount = sort === 'hot';

    // ---- COUNT 和 LIST 并行执行（热门帖跳过 COUNT）----
    let total = 0;
    let postRows: Record<string, unknown>[] = [];

    if (skipCount) {
      // 热门帖子：仅查列表，跳过 COUNT
      try {
        const rows = await queryWithTimeout(
          db,
          `SELECT p.id, p.title, substr(p.content, 1, 200) as summary_content,
                  p.view_count, p.like_count, p.comment_count, p.is_pinned, p.is_essence,
                  p.created_at, p.post_type, p.author_name, p.status, p.is_ai_generated,
                  u.id as author_id, u.username as author_username, u.avatar as author_avatar,
                  c.id as cat_id, c.name as cat_name, c.slug as cat_slug
           FROM Post p
           LEFT JOIN User u ON p.author_id = u.id
           LEFT JOIN Category c ON p.category_id = c.id
           ${whereClause}
           ORDER BY ${orderClause}
           LIMIT ? OFFSET ?`,
          [...args, limit, offset],
          QUERY_TIMEOUT,
        );
        postRows = rows as Record<string, unknown>[];
      } catch (listErr) {
        const detail = listErr instanceof Error ? listErr.message : String(listErr);
        console.error('[POSTS LIST QUERY ERROR]', detail);
        return NextResponse.json(
          { error: '获取帖子列表失败', detail, hint: '数据库查询超时或失败，请稍后重试' },
          { status: 503 }
        );
      }
    } else {
      // 标准模式：COUNT 和 LIST 并行执行
      const [countResult, listResult] = await Promise.allSettled([
        queryWithTimeout(
          db,
          `SELECT COUNT(*) as total FROM Post p
           LEFT JOIN Category c ON p.category_id = c.id
           ${whereClause}`,
          [...args],
          QUERY_TIMEOUT,
        ),
        queryWithTimeout(
          db,
          `SELECT p.id, p.title, substr(p.content, 1, 200) as summary_content,
                  p.view_count, p.like_count, p.comment_count, p.is_pinned, p.is_essence,
                  p.created_at, p.post_type, p.author_name, p.status, p.is_ai_generated,
                  u.id as author_id, u.username as author_username, u.avatar as author_avatar,
                  c.id as cat_id, c.name as cat_name, c.slug as cat_slug
           FROM Post p
           LEFT JOIN User u ON p.author_id = u.id
           LEFT JOIN Category c ON p.category_id = c.id
           ${whereClause}
           ORDER BY ${orderClause}
           LIMIT ? OFFSET ?`,
          [...args, limit, offset],
          QUERY_TIMEOUT,
        ),
      ]);

      // 处理 COUNT 结果
      if (countResult.status === 'fulfilled') {
        total = Number((countResult.value as Record<string, unknown>[])[0]?.total) || 0;
      } else {
        console.error('[POSTS COUNT ERROR]', countResult.reason?.message || countResult.reason);
      }

      // 处理 LIST 结果
      if (listResult.status === 'fulfilled') {
        postRows = listResult.value as Record<string, unknown>[];
      } else {
        const detail = listResult.reason instanceof Error ? listResult.reason.message : String(listResult.reason);
        console.error('[POSTS LIST QUERY ERROR]', detail);
        return NextResponse.json(
          { error: '获取帖子列表失败', detail, hint: '数据库查询超时或失败，请稍后重试' },
          { status: 503 }
        );
      }
    }

    // ---- 查询帖子标签（如果有帖子返回）----
    let tagsMap: Map<string, Array<{ tag: { id: string; name: string; slug: string } }>> = new Map();

    if (postRows.length > 0) {
      try {
        const postIds = postRows.map((p) => p.id as string).filter(Boolean);
        if (postIds.length > 0) {
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
            const postId = row.post_id as string;
            if (!tagsMap.has(postId)) tagsMap.set(postId, []);
            tagsMap.get(postId)!.push({
              tag: {
                id: row.tag_id as string,
                name: row.tag_name as string,
                slug: row.tag_slug as string,
              },
            });
          }
        }
      } catch (tagErr) {
        console.error('[POSTS TAG QUERY ERROR]', tagErr instanceof Error ? tagErr.message : tagErr);
        // 标签查询失败不影响帖子列表主体返回
      }
    }

    // ---- 格式化返回数据 ----
    const postsWithSummary = postRows.map((p) => ({
      id: p.id,
      title: p.title,
      content: p.summary_content || '',
      summary: p.summary_content ? (p.summary_content as string).length >= 200
        ? (p.summary_content as string) + '...'
        : p.summary_content as string
        : '',
      viewCount: Number(p.view_count) || 0,
      likeCount: Number(p.like_count) || 0,
      commentCount: Number(p.comment_count) || 0,
      isPinned: Boolean(p.is_pinned),
      isEssence: Boolean(p.is_essence),
      createdAt: p.created_at,
      postType: p.post_type,
      status: p.status,
      isAIGenerated: Boolean(p.is_ai_generated),
      author: {
        id: p.author_id || '',
        username: p.author_name || p.author_username || '匿名',
        avatar: p.author_avatar || null,
      },
      category: p.cat_id
        ? {
            id: p.cat_id as string,
            name: getCategoryDisplayName(p.cat_name as string, p.cat_slug as string),
            slug: p.cat_slug as string,
          }
        : null,
      tags: tagsMap.get(p.id as string) || [],
    }));

    return NextResponse.json({
      posts: postsWithSummary,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack?.split('\n').slice(0, 4).join('\n') : '';
    console.error('[POSTS LIST ERROR]', detail, stack);
    return NextResponse.json(
      {
        error: '获取帖子列表失败',
        detail: process.env.NODE_ENV === 'production' ? undefined : detail,
        hint: '服务器内部错误，请联系管理员',
      },
      { status: 500 }
    );
  }
}

// ============ POST /api/forum/posts - 发布新帖 ============
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, content, categoryId, tags, postType: rawPostType, authorName, isAIGenerated } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: '标题和内容不能为空' },
        { status: 400 }
      );
    }

    if (title.length > 100) {
      return NextResponse.json(
        { error: '标题不能超过 100 个字符' },
        { status: 400 }
      );
    }

    const postType = rawPostType === 'question' ? 'question' : 'discussion';

    const safeAuthorName = (user.role === 'ADMIN' && typeof authorName === 'string' && authorName.trim())
      ? authorName.trim().slice(0, 50)
      : undefined;

    let tagEntries: { name: string; slug: string }[] = [];
    if (tags !== undefined && tags !== null) {
      if (!Array.isArray(tags)) {
        return NextResponse.json(
          { error: '标签必须为字符串数组' },
          { status: 400 }
        );
      }
      const seenSlugs = new Set<string>();
      for (const raw of tags) {
        const name = String(raw).trim();
        if (!name) continue;
        const slug = name.toLowerCase().replace(/\s+/g, '-');
        if (seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);
        tagEntries.push({ name, slug });
        if (tagEntries.length >= 5) break;
      }
    }

    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        return NextResponse.json(
          { error: '分类不存在' },
          { status: 400 }
        );
      }
    }

    const latestPost = await prisma.post.findFirst({
      where: { authorId: user.userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (latestPost) {
      const COOLDOWN_MS = 60 * 1000;
      const elapsedMs = Date.now() - latestPost.createdAt.getTime();
      if (elapsedMs < COOLDOWN_MS) {
        const waitSec = Math.ceil((COOLDOWN_MS - elapsedMs) / 1000);
        return NextResponse.json(
          { error: `发帖过于频繁，请 ${waitSec} 秒后再试` },
          { status: 429 }
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          title,
          content,
          authorId: user.userId,
          categoryId: categoryId || null,
          status: 'PUBLISHED',
          postType,
          ...(safeAuthorName && { authorName: safeAuthorName }),
          ...(isAIGenerated === true && { isAIGenerated: true }),
        },
      });

      for (const { name, slug } of tagEntries) {
        const tag = await tx.tag.upsert({
          where: { slug },
          update: { postCount: { increment: 1 } },
          create: { name, slug, postCount: 1 },
        });
        await tx.postTag.create({
          data: { postId: post.id, tagId: tag.id },
        });
      }

      await tx.user.update({
        where: { id: user.userId },
        data: { postCount: { increment: 1 } },
      });

      return post;
    });

    const post = await prisma.post.findUnique({
      where: { id: created.id },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        category: { select: { id: true, name: true, slug: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      },
    });

    revalidateCommunityHome();

    const displayPost = post?.authorName
      ? { ...post, author: { ...post.author, username: post.authorName } }
      : post;

    return NextResponse.json(displayPost, { status: 201 });
  } catch (error) {
    console.error('[POST CREATE ERROR]', error);
    return NextResponse.json(
      { error: '发布帖子失败' },
      { status: 500 }
    );
  }
}
