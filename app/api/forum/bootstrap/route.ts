import { NextResponse } from 'next/server';
import { getDb, queryWithTimeout } from '@/lib/db';
import { checkDbOr503 } from '@/lib/db-check';
import { getCategoryDisplayName } from '@/lib/utils';

/**
 * GET /api/forum/bootstrap
 *
 * 聚合接口：一次性返回论坛首屏所需的全部数据
 *   - categories: 分类列表
 *   - stats: 社区统计（帖子数、用户数、今日新增）
 *   - hotPosts: 热门帖子（5 条）
 *   - tags: 热门标签（20 条）
 *
 * 所有子查询并行执行，任一失败不影响其他数据返回。
 * 使用模块级缓存（30 秒 TTL）减少数据库压力。
 */

// 模块级缓存
interface BootstrapData {
  categories: unknown[];
  stats: { totalPosts: number; totalUsers: number; todayPosts: number };
  hotPosts: unknown[];
  tags: unknown[];
  fetchedAt: string;
}

let cachedBootstrap: BootstrapData | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 30_000; // 30 秒

const QUERY_TIMEOUT = 5000;

export async function GET() {
  // 命中缓存直接返回
  const now = Date.now();
  if (cachedBootstrap && now < cacheExpiry) {
    return NextResponse.json(cachedBootstrap, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'X-Cache': 'HIT',
      },
    });
  }

  const dbError = checkDbOr503();
  if (dbError) return dbError;

  let db;
  try {
    db = getDb();
  } catch {
    return NextResponse.json(
      { error: '数据库连接失败' },
      { status: 503 },
    );
  }

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  // 所有子查询并行执行，互不阻塞
  const [categoriesResult, statsResult, hotPostsResult, tagsResult] = await Promise.allSettled([
    // 1. 分类列表
    queryWithTimeout(
      db,
      `SELECT c.id, c.name, c.slug, c.icon, c.desc, c.sort_order,
              COUNT(p.id) as post_count
       FROM Category c
       LEFT JOIN Post p ON c.id = p.category_id AND p.status = 'PUBLISHED'
       GROUP BY c.id
       ORDER BY c.sort_order ASC`,
      [],
      QUERY_TIMEOUT,
    ),

    // 2. 统计数据（单条 SQL，4 个子查询合并）
    queryWithTimeout(
      db,
      `SELECT
         (SELECT COUNT(*) FROM Post WHERE status = 'PUBLISHED') as post_count,
         (SELECT COUNT(*) FROM User) as user_count,
         (SELECT COUNT(*) FROM Post WHERE status = 'PUBLISHED' AND created_at >= ?) as today_post_count`,
      [todayStart],
      QUERY_TIMEOUT,
    ),

    // 3. 热门帖子（仅 5 条，不需要 COUNT）
    queryWithTimeout(
      db,
      `SELECT p.id, p.title, substr(p.content, 1, 200) as summary_content,
              p.view_count, p.like_count, p.comment_count, p.is_pinned, p.is_essence,
              p.created_at, p.post_type, p.author_name, p.is_ai_generated,
              u.id as author_id, u.username as author_username, u.avatar as author_avatar,
              c.id as cat_id, c.name as cat_name, c.slug as cat_slug
       FROM Post p
       LEFT JOIN User u ON p.author_id = u.id
       LEFT JOIN Category c ON p.category_id = c.id
       WHERE p.status = 'PUBLISHED'
       ORDER BY p.is_pinned DESC, p.like_count DESC, p.view_count DESC, p.created_at DESC
       LIMIT 5`,
      [],
      QUERY_TIMEOUT,
    ),

    // 4. 热门标签（20 条）
    queryWithTimeout(
      db,
      `SELECT id, name, slug, post_count
       FROM Tag
       ORDER BY post_count DESC, created_at DESC
       LIMIT 20`,
      [],
      QUERY_TIMEOUT,
    ),
  ]);

  // ---- 处理分类 ----
  let categories: unknown[] = [];
  if (categoriesResult.status === 'fulfilled') {
    categories = (categoriesResult.value as Record<string, unknown>[]).map((cat) => ({
      id: cat.id,
      name: getCategoryDisplayName(cat.name as string, cat.slug as string),
      slug: cat.slug,
      icon: cat.icon,
      desc: cat.desc,
      sortOrder: Number(cat.sort_order) || 0,
      postCount: Number(cat.post_count) || 0,
    }));
  } else {
    console.error('[BOOTSTRAP] categories failed:', categoriesResult.reason?.message || categoriesResult.reason);
  }

  // ---- 处理统计 ----
  let stats = { totalPosts: 0, totalUsers: 0, todayPosts: 0 };
  if (statsResult.status === 'fulfilled') {
    const row = (statsResult.value as Record<string, unknown>[])[0] || {};
    stats = {
      totalPosts: Number(row.post_count) || 0,
      totalUsers: Number(row.user_count) || 0,
      todayPosts: Number(row.today_post_count) || 0,
    };
  } else {
    console.error('[BOOTSTRAP] stats failed:', statsResult.reason?.message || statsResult.reason);
  }

  // ---- 处理热门帖子 ----
  let hotPosts: unknown[] = [];
  if (hotPostsResult.status === 'fulfilled') {
    hotPosts = (hotPostsResult.value as Record<string, unknown>[]).map((p) => ({
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
      isAIGenerated: Boolean(p.is_ai_generated),
      author: {
        id: p.author_id || '',
        username: p.author_name || p.author_username || '匿名',
        avatar: p.author_avatar || null,
      },
      category: p.cat_id
        ? { id: p.cat_id as string, name: p.cat_name as string, slug: p.cat_slug as string }
        : null,
    }));
  } else {
    console.error('[BOOTSTRAP] hotPosts failed:', hotPostsResult.reason?.message || hotPostsResult.reason);
  }

  // ---- 处理标签 ----
  let tags: unknown[] = [];
  if (tagsResult.status === 'fulfilled') {
    tags = (tagsResult.value as Record<string, unknown>[]).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      postCount: Number(t.post_count) || 0,
    }));
  } else {
    console.error('[BOOTSTRAP] tags failed:', tagsResult.reason?.message || tagsResult.reason);
  }

  const result: BootstrapData = {
    categories,
    stats,
    hotPosts,
    tags,
    fetchedAt: new Date().toISOString(),
  };

  // 写入缓存
  cachedBootstrap = result;
  cacheExpiry = now + CACHE_TTL;

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      'X-Cache': 'MISS',
    },
  });
}
