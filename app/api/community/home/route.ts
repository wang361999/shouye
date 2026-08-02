import { NextResponse } from 'next/server';
import { getDb, batchWithTimeout } from '@/lib/db';
import type { InStatement } from '@libsql/client';
import { stripMarkdown, truncateText, formatTimeAgo } from '@/lib/utils';

// ============ 缓存策略 ============
// 两级缓存：内容数据 2 分钟，统计数据 10 分钟
// stale-while-revalidate：缓存过期时先返回旧数据，后台静默刷新

let contentCache: object | null = null;
let contentCacheExpiry = 0;
const CONTENT_TTL = 120_000; // 2 分钟

let statsCache: object | null = null;
let statsCacheExpiry = 0;
const STATS_TTL = 600_000; // 10 分钟

const BATCH_TIMEOUT = 6000; // 批量查询总超时 6 秒

/**
 * GET /api/community/home - 社区首页聚合数据
 *
 * 性能优化：
 *   1. libsql batch API — 5 条查询合并为 1 次 HTTP 请求（减少 80% 网络延迟）
 *   2. 数据库索引 — 覆盖所有 WHERE + ORDER BY 组合
 *   3. 两级缓存 — 内容 2min / 统计 10min，过期后先返回旧数据再后台刷新
 *   4. substr() — 只取内容摘要，减少数据传输量
 */
export async function GET() {
  const now = Date.now();

  // 两级缓存都命中 → 直接返回
  if (contentCache && statsCache && now < contentCacheExpiry && now < statsCacheExpiry) {
    return NextResponse.json({ ...contentCache, ...statsCache }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
  }

  const db = getDb();
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  // 判断需要查询哪些数据
  const needContent = !contentCache || now >= contentCacheExpiry;
  const needStats = !statsCache || now >= statsCacheExpiry;

  // 构建批量查询语句（只查需要的部分）
  const statements: InStatement[] = [];

  if (needContent) {
    // 1. 最新帖子（6条）
    statements.push({
      sql: `SELECT p.id, p.title, substr(p.content, 1, 300) as content,
                   p.view_count, p.like_count, p.comment_count, p.is_pinned, p.is_essence,
                   p.created_at, p.author_name,
                   u.id as author_id, u.username as author_username, u.avatar as author_avatar,
                   c.id as cat_id, c.name as cat_name, c.slug as cat_slug
            FROM Post p
            LEFT JOIN User u ON p.author_id = u.id
            LEFT JOIN Category c ON p.category_id = c.id
            WHERE p.status = 'PUBLISHED'
            ORDER BY p.is_pinned DESC, p.created_at DESC
            LIMIT 6`,
      args: [],
    });

    // 2. 热门讨论（5条）
    statements.push({
      sql: `SELECT p.id, p.title,
                   p.view_count, p.like_count, p.comment_count, p.is_pinned, p.is_essence,
                   p.created_at, p.author_name,
                   u.id as author_id, u.username as author_username, u.avatar as author_avatar,
                   c.id as cat_id, c.name as cat_name, c.slug as cat_slug
            FROM Post p
            LEFT JOIN User u ON p.author_id = u.id
            LEFT JOIN Category c ON p.category_id = c.id
            WHERE p.status = 'PUBLISHED'
            ORDER BY p.is_pinned DESC, p.like_count DESC, p.view_count DESC
            LIMIT 5`,
      args: [],
    });

    // 3. 活跃成员（8人）
    statements.push({
      sql: `SELECT id, username, avatar, bio, post_count, comment_count
            FROM User
            WHERE status = 'active'
            ORDER BY post_count DESC, comment_count DESC
            LIMIT 8`,
      args: [],
    });

    // 4. 协作召集令（6条）
    statements.push({
      sql: `SELECT cp.id, cp.title, substr(cp.description, 1, 300) as description,
                   cp.repo_owner, cp.repo_name, cp.status, cp.tech_stack, cp.tags,
                   cp.member_count, cp.max_members, cp.task_count, cp.completed_task_count,
                   cp.contribution_count, cp.created_at,
                   u.id as author_id, u.username as author_username, u.avatar as author_avatar
            FROM CollabProject cp
            LEFT JOIN User u ON cp.author_id = u.id
            WHERE cp.status IN ('recruiting', 'active')
            ORDER BY cp.created_at DESC
            LIMIT 6`,
      args: [],
    });
  }

  if (needStats) {
    // 5. 社区统计（4 合 1）
    statements.push({
      sql: `SELECT
              (SELECT COUNT(*) FROM User) as user_count,
              (SELECT COUNT(*) FROM Post WHERE status = 'PUBLISHED') as post_count,
              (SELECT COUNT(*) FROM Comment WHERE deleted_at IS NULL AND is_approved = 1) as comment_count,
              (SELECT COUNT(*) FROM Post WHERE status = 'PUBLISHED' AND created_at >= ?) as today_post_count`,
      args: [todayStart],
    });
  }

  // 执行批量查询（单次 HTTP 请求）
  const batchResults = await batchWithTimeout(db, statements, BATCH_TIMEOUT);

  // 批量查询失败 → 返回缓存（即使过期）或空数据
  if (!batchResults) {
    const fallbackContent = contentCache || {
      latestPosts: [], hotPosts: [], activeMembers: [], collabProjects: [],
    };
    const fallbackStats = statsCache || {
      stats: { userCount: 0, postCount: 0, commentCount: 0, todayPostCount: 0 },
    };
    return NextResponse.json({ ...fallbackContent, ...fallbackStats }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
    });
  }

  // 按 push 顺序解析结果
  let idx = 0;

  // ============ 解析内容数据 ============
  if (needContent) {
    const latestRows = batchResults[idx++]?.rows ?? [];
    const hotRows = batchResults[idx++]?.rows ?? [];
    const memberRows = batchResults[idx++]?.rows ?? [];
    const collabRows = batchResults[idx++]?.rows ?? [];

    const parseJsonArray = (value: unknown): string[] => {
      if (!value || typeof value !== 'string') return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
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
        ? { id: row.cat_id as string, name: row.cat_name as string, slug: row.cat_slug as string }
        : null,
    });

    const formattedLatest = (latestRows as Record<string, unknown>[]).map(formatPost);
    const formattedHot = (hotRows as Record<string, unknown>[]).map(formatPost);

    const formattedMembers = (memberRows as Record<string, unknown>[]).map((u) => ({
      id: u.id,
      username: u.username,
      avatar: u.avatar,
      bio: (u.bio as string) || '',
      postCount: Number(u.post_count) || 0,
      commentCount: Number(u.comment_count) || 0,
    }));

    const formattedCollab = (collabRows as Record<string, unknown>[]).map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.description ? truncateText(stripMarkdown(p.description as string), 100) : '',
      repoOwner: p.repo_owner || '',
      repoName: p.repo_name || '',
      status: p.status,
      techStack: parseJsonArray(p.tech_stack),
      tags: parseJsonArray(p.tags),
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

    // 只在有帖子数据时才缓存（避免降级空结果被缓存）
    if (formattedLatest.length > 0) {
      contentCache = {
        latestPosts: formattedLatest,
        hotPosts: formattedHot,
        activeMembers: formattedMembers,
        collabProjects: formattedCollab,
      };
      contentCacheExpiry = now + CONTENT_TTL;
    }
  }

  // ============ 解析统计数据 ============
  if (needStats) {
    const statsRow = (batchResults[idx]?.rows?.[0] as Record<string, unknown>) || {};
    statsCache = {
      stats: {
        userCount: Number(statsRow.user_count) || 0,
        postCount: Number(statsRow.post_count) || 0,
        commentCount: Number(statsRow.comment_count) || 0,
        todayPostCount: Number(statsRow.today_post_count) || 0,
      },
    };
    statsCacheExpiry = now + STATS_TTL;
  }

  const result = { ...(contentCache as object), ...(statsCache as object) };

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
  });
}
