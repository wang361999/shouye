import { NextResponse } from 'next/server';
import { getDb, queryWithTimeout } from '@/lib/db';
import { checkDbOr503 } from '@/lib/db-check';
import { stripMarkdown, truncateText, formatTimeAgo, getCategoryDisplayName } from '@/lib/utils';

// 社区首页数据必须运行时读取数据库，不能在构建期静态化，否则移动端会拿到空数据
export const dynamic = 'force-dynamic';

// ============ 两级缓存 ============
// 内容数据 2 分钟，统计数据 10 分钟；移动端和桌面端分开缓存，避免互相覆盖
let contentCache: Record<string, object | null> = {};
let contentCacheExpiry: Record<string, number> = {};
const CONTENT_TTL = 120_000;

let statsCache: object | null = null;
let statsCacheExpiry = 0;
const STATS_TTL = 600_000;

const QUERY_TIMEOUT = 8000;

/**
 * GET /api/community/home - 社区首页聚合数据
 *
 * 优化策略：
 *   1. 原生 SQL 替代 Prisma（无 ORM 开销）
 *   2. 顺序执行查询（避免 Promise.all 并发 HTTP 请求失败）
 *   3. 单个查询失败降级返回空数组，不影响其他数据
 *   4. 数据库索引覆盖所有 WHERE + ORDER BY
 *   5. substr() 只取内容摘要减少传输量
 *   6. 两级缓存：内容 2min / 统计 10min
 */
export async function GET(request: Request) {
  const now = Date.now();
  const { searchParams } = new URL(request.url);
  const isMobileView = searchParams.get('view') === 'mobile';
  const cacheKey = isMobileView ? 'mobile' : 'default';
  const cachedContent = contentCache[cacheKey];
  const cachedContentExpiry = contentCacheExpiry[cacheKey] || 0;
  const latestLimit = isMobileView ? 8 : 12;
  const hotLimit = isMobileView ? 8 : 12;
  const collabLimit = isMobileView ? 4 : 6;
  const toolLimit = isMobileView ? 4 : 6;
  const shouldLoadMembers = !isMobileView;

  // 两级缓存都命中 → 直接返回
  if (cachedContent && statsCache && now < cachedContentExpiry && now < statsCacheExpiry) {
    return NextResponse.json({ ...cachedContent, ...statsCache }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  }

  // 获取数据库客户端，失败时返回缓存或空数据
  let db;
  const dbError = checkDbOr503();
  if (dbError) return dbError;
  try {
    db = getDb();
  } catch {
    const fallbackContent = cachedContent || {
      latestPosts: [], hotPosts: [], activeMembers: [], collabProjects: [], featuredTools: [],
    };
    const fallbackStats = statsCache || {
      stats: { userCount: 0, postCount: 0, commentCount: 0, todayPostCount: 0 },
    };
    return NextResponse.json({ ...fallbackContent, ...fallbackStats }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
    });
  }

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const needContent = !cachedContent || now >= cachedContentExpiry;
  const needStats = !statsCache || now >= statsCacheExpiry;

  // ============ 内容数据（顺序查询，避免并发 HTTP 请求失败） ============
  let latestRows: Record<string, unknown>[] = [];
  let hotRows: Record<string, unknown>[] = [];
  let memberRows: Record<string, unknown>[] = [];
  let collabRows: Record<string, unknown>[] = [];
  let toolRows: Record<string, unknown>[] = [];

  if (needContent) {
    // 1. 最新帖子
    try {
      const rows = await queryWithTimeout(
        db,
        `SELECT p.id, p.title, substr(p.content, 1, 300) as content,
                p.view_count, p.like_count, p.comment_count, p.is_pinned, p.is_essence,
                p.created_at, p.author_name,
                u.id as author_id, u.username as author_username, u.avatar as author_avatar,
                c.id as cat_id, c.name as cat_name, c.slug as cat_slug
         FROM Post p
         LEFT JOIN User u ON p.author_id = u.id
         LEFT JOIN Category c ON p.category_id = c.id
         WHERE p.status = 'PUBLISHED'
         ORDER BY p.is_pinned DESC, p.created_at DESC
         LIMIT ${latestLimit}`,
        [],
        QUERY_TIMEOUT,
      );
      latestRows = rows as Record<string, unknown>[];
    } catch (err) {
      console.error('[HOME LATEST POSTS ERROR]', err instanceof Error ? err.message : err);
      // 降级：返回空数组
    }

    // 2. 热门讨论
    try {
      const rows = await queryWithTimeout(
        db,
        `SELECT p.id, p.title,
                p.view_count, p.like_count, p.comment_count, p.is_pinned, p.is_essence,
                p.created_at, p.author_name,
                u.id as author_id, u.username as author_username, u.avatar as author_avatar,
                c.id as cat_id, c.name as cat_name, c.slug as cat_slug
         FROM Post p
         LEFT JOIN User u ON p.author_id = u.id
         LEFT JOIN Category c ON p.category_id = c.id
         WHERE p.status = 'PUBLISHED'
         ORDER BY p.is_pinned DESC, p.like_count DESC, p.view_count DESC
         LIMIT ${hotLimit}`,
        [],
        QUERY_TIMEOUT,
      );
      hotRows = rows as Record<string, unknown>[];
    } catch (err) {
      console.error('[HOME HOT POSTS ERROR]', err instanceof Error ? err.message : err);
    }

    // 3. 活跃成员（移动端不展示，跳过查询）
    if (shouldLoadMembers) {
      try {
        const rows = await queryWithTimeout(
          db,
          `SELECT id, username, avatar, bio, post_count, comment_count
           FROM User
           WHERE status = 'active'
           ORDER BY post_count DESC, comment_count DESC
           LIMIT 8`,
          [],
          QUERY_TIMEOUT,
        );
        memberRows = rows as Record<string, unknown>[];
      } catch (err) {
        console.error('[HOME ACTIVE MEMBERS ERROR]', err instanceof Error ? err.message : err);
      }
    }

    // 4. 协作召集令（6条）
    try {
      const rows = await queryWithTimeout(
        db,
        `SELECT cp.id, cp.title, substr(cp.description, 1, 300) as description,
                cp.repo_owner, cp.repo_name, cp.status, cp.tech_stack, cp.tags,
                cp.member_count, cp.max_members, cp.task_count, cp.completed_task_count,
                cp.contribution_count, cp.created_at,
                u.id as author_id, u.username as author_username, u.avatar as author_avatar
         FROM CollabProject cp
         LEFT JOIN User u ON cp.author_id = u.id
         WHERE cp.status IN ('recruiting', 'active')
         ORDER BY cp.created_at DESC
         LIMIT ${collabLimit}`,
        [],
        QUERY_TIMEOUT,
      );
      collabRows = rows as Record<string, unknown>[];
    } catch (err) {
      console.error('[HOME COLLAB PROJECTS ERROR]', err instanceof Error ? err.message : err);
    }

    // 5. 精选工具（固定 6 条：优先 is_featured，其次 click_count）
    try {
      const rows = await queryWithTimeout(
        db,
        `SELECT id, name, description, icon, category, tool_type, click_count
         FROM Tool
         WHERE is_active = 1
         ORDER BY is_featured DESC, click_count DESC, created_at DESC
         LIMIT ${toolLimit}`,
        [],
        QUERY_TIMEOUT,
      );
      toolRows = rows as Record<string, unknown>[];
    } catch (err) {
      console.error('[HOME TOOLS ERROR]', err instanceof Error ? err.message : err);
    }
  }

  // ============ 统计数据（独立查询） ============
  let statsData = { userCount: 0, postCount: 0, commentCount: 0, todayPostCount: 0 };

  if (needStats) {
    try {
      const rows = await queryWithTimeout(
        db,
        `SELECT
           (SELECT COUNT(*) FROM User) as user_count,
           (SELECT COUNT(*) FROM Post WHERE status = 'PUBLISHED') as post_count,
           (SELECT COUNT(*) FROM Comment WHERE deleted_at IS NULL AND is_approved = 1) as comment_count,
           (SELECT COUNT(*) FROM Post WHERE status = 'PUBLISHED' AND created_at >= ?) as today_post_count`,
        [todayStart],
        QUERY_TIMEOUT,
      );
      const statsRows = rows as Record<string, unknown>[];
      const statsRow = statsRows?.[0] || {};
      statsData = {
        userCount: Number(statsRow.user_count) || 0,
        postCount: Number(statsRow.post_count) || 0,
        commentCount: Number(statsRow.comment_count) || 0,
        todayPostCount: Number(statsRow.today_post_count) || 0,
      };
    } catch (err) {
      console.error('[HOME STATS ERROR]', err instanceof Error ? err.message : err);
    }
  }

  // ============ 格式化数据 ============
  const parseListValue = (value: unknown): string[] => {
    if (!value || typeof value !== 'string') return [];
    const trimmed = value.trim();
    if (!trimmed) return [];
    // 尝试 JSON 数组格式 ["a","b"]
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // 不是 JSON，继续尝试逗号分隔
    }
    // 逗号分隔格式 a,b,c（兼容中英文逗号）
    return trimmed.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  };

  const formatPost = (row: Record<string, unknown>) => ({
    id: row.id,
    title: row.title,
    summary: row.content ? truncateText(stripMarkdown(row.content as string), 120) : '',
    viewCount: Number(row.view_count) || 0,
    likeCount: Number(row.like_count) || 0,
    commentCount: Number(row.comment_count) || 0,
    isPinned: Boolean(row.is_pinned),
    isEssence: Boolean(row.is_essence),
    timeAgo: formatTimeAgo(new Date(row.created_at as string)),
    author: {
      id: row.author_id || '',
      username: row.author_name || row.author_username || '匿名',
      avatar: row.author_avatar || null,
    },
    category: row.cat_id
      ? { id: row.cat_id as string, name: getCategoryDisplayName(row.cat_name as string, row.cat_slug as string), slug: row.cat_slug as string }
      : null,
  });

  const formattedLatest = latestRows.map(formatPost);
  const formattedHot = hotRows.map(formatPost);

  const formattedMembers = memberRows.map((u) => ({
    id: u.id,
    username: u.username,
    avatar: u.avatar,
    bio: (u.bio as string) || '',
    postCount: Number(u.post_count) || 0,
    commentCount: Number(u.comment_count) || 0,
  }));

  const formattedCollab = collabRows.map((p) => ({
    id: p.id,
    title: p.title,
    summary: p.description ? truncateText(stripMarkdown(p.description as string), 100) : '',
    repoOwner: p.repo_owner || '',
    repoName: p.repo_name || '',
    status: p.status,
    techStack: parseListValue(p.tech_stack),
    tags: parseListValue(p.tags),
    memberCount: Number(p.member_count) || 0,
    maxMembers: Number(p.max_members) || 0,
    taskCount: Number(p.task_count) || 0,
    completedTaskCount: Number(p.completed_task_count) || 0,
    contributionCount: Number(p.contribution_count) || 0,
    timeAgo: formatTimeAgo(new Date(p.created_at as string)),
    author: {
      id: p.author_id || '',
      username: p.author_username || '匿名',
      avatar: p.author_avatar || null,
    },
  }));

  const formattedTools = toolRows.map((t) => ({
    id: t.id,
    name: t.name,
    description: (t.description as string) || '',
    icon: t.icon || '',
    category: t.category || '实用工具',
    toolType: t.tool_type || 'link',
    clickCount: Number(t.click_count) || 0,
  }));

  // 只在有帖子数据时才缓存
  if (formattedLatest.length > 0) {
    contentCache[cacheKey] = {
      latestPosts: formattedLatest,
      hotPosts: formattedHot,
      activeMembers: formattedMembers,
      collabProjects: formattedCollab,
      featuredTools: formattedTools,
    };
    contentCacheExpiry[cacheKey] = now + CONTENT_TTL;
  }

  const responseData = { ...(contentCache[cacheKey] || {}), stats: statsData };
  statsCacheExpiry = now + STATS_TTL;

  const result = { ...(contentCache as object), ...(statsCache as object) };

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
  });
}
