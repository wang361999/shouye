import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDb, queryWithTimeout } from '@/lib/db';
import { checkDbOr503 } from '@/lib/db-check';
import type { InValue } from '@libsql/client/http';
import { getUserFromRequest, adminAuth } from '@/lib/auth';
import { revalidateCommunityHome } from '@/lib/revalidate';

const QUERY_TIMEOUT = 6000;

// ============ GET /api/forum/posts - 获取帖子列表 ============
// 使用原生 SQL 替代 Prisma，支持分页/搜索/分类/排序/标签/类型过滤
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const categorySlug = searchParams.get('category') || undefined;
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
      conditions.push("(p.title LIKE '%' || ? || '%' OR p.content LIKE '%' || ? || '%' OR EXISTS (SELECT 1 FROM PostTag pt JOIN Tag t ON pt.tag_id = t.id WHERE pt.post_id = p.id AND t.name LIKE '%' || ? || '%'))");
      args.push(search, search, search);
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
    if (sort === 'hot') {
      orderClause = 'p.is_pinned DESC, p.like_count DESC, p.view_count DESC, p.created_at DESC';
    } else {
      orderClause = 'p.is_pinned DESC, p.created_at DESC';
    }

    const offset = (page - 1) * limit;

    let db;
    const dbError = checkDbOr503();
    if (dbError) return dbError;
    try {
      db = getDb();
    } catch {
      return NextResponse.json({ posts: [], total: 0, page, totalPages: 1 });
    }

    // ---- 并行查询帖子列表 + 总数 ----
    const listArgs = [...args];
    const countArgs = [...args];

    const [postRows, countRows] = await Promise.all([
      queryWithTimeout(
        db,
        `SELECT p.id, p.title, substr(p.content, 1, 200) as summary_content,
                p.view_count, p.like_count, p.comment_count, p.is_pinned, p.is_essence,
                p.created_at, p.post_type, p.author_name, p.status,
                u.id as author_id, u.username as author_username, u.avatar as author_avatar,
                c.id as cat_id, c.name as cat_name, c.slug as cat_slug
         FROM Post p
         LEFT JOIN User u ON p.author_id = u.id
         LEFT JOIN Category c ON p.category_id = c.id
         ${whereClause}
         ORDER BY ${orderClause}
         LIMIT ? OFFSET ?`,
        [...listArgs, limit, offset],
        QUERY_TIMEOUT,
      ),
      queryWithTimeout(
        db,
        `SELECT COUNT(*) as total FROM Post p
         LEFT JOIN Category c ON p.category_id = c.id
         ${whereClause}`,
        countArgs,
        QUERY_TIMEOUT,
      ),
    ]);

    const total = Number((countRows as Record<string, unknown>[])[0]?.total) || 0;

    // ---- 查询帖子标签（如果有帖子返回）----
    const posts = postRows as Record<string, unknown>[];
    let tagsMap: Map<string, Array<{ tag: { id: string; name: string; slug: string } }>> = new Map();

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

    // ---- 格式化返回数据 ----
    const postsWithSummary = posts.map((p) => ({
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
      author: {
        id: p.author_id || '',
        username: p.author_name || p.author_username || '匿名',
        avatar: p.author_avatar || null,
      },
      category: p.cat_id
        ? { id: p.cat_id as string, name: p.cat_name as string, slug: p.cat_slug as string }
        : null,
      tags: tagsMap.get(p.id as string) || [],
    }));

    return NextResponse.json({
      posts: postsWithSummary,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('[POSTS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取帖子列表失败' },
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
    const { title, content, categoryId, tags, postType: rawPostType, authorName } = body;

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
