import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ============ 搜索结果缓存 ============
// 相同关键词 + 页码 + 类型的搜索结果缓存 5 分钟
// 减少重复搜索的数据库压力，提升响应速度
const searchCache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 300_000; // 5 分钟
const MAX_CACHE_ENTRIES = 200; // 最多缓存 200 个不同搜索词

function getCacheKey(q: string, page: number, limit: number, type: string): string {
  return `${q.toLowerCase()}:${page}:${limit}:${type}`;
}

function getCachedResult(key: string): unknown | null {
  const cached = searchCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }
  // 过期了就删除
  if (cached) {
    searchCache.delete(key);
  }
  return null;
}

function setCachedResult(key: string, data: unknown): void {
  // 缓存过多时，清理最旧的一批（简单策略：删一半）
  if (searchCache.size >= MAX_CACHE_ENTRIES) {
    const keys = Array.from(searchCache.keys());
    const half = Math.floor(keys.length / 2);
    for (let i = 0; i < half; i++) {
      searchCache.delete(keys[i]);
    }
  }
  searchCache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

// ============ GET /api/search - 全站搜索 ============
// 参数: ?q=关键词&page=1&limit=10&type=all|posts|tools
// 返回: { posts: [...], tools: [...], total }
//   - 帖子：{ id, title, content(截断200字符), author: {username}, category: {name}, createdAt }
//   - 工具：{ id, name, description, icon, url }
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const type = searchParams.get('type') || 'all'; // all | posts | tools

    // ---- 关键词为空时返回空结果 ----
    if (!q) {
      return NextResponse.json({
        posts: [],
        tools: [],
        total: 0,
        page,
        limit,
        q: '',
      });
    }

    // ---- 检查缓存 ----
    const cacheKey = getCacheKey(q, page, limit, type);
    const cached = getCachedResult(cacheKey);
    if (cached) {
      return NextResponse.json(cached as Record<string, unknown>, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          'X-Cache': 'HIT',
        },
      });
    }

    // ---- 根据类型决定搜索范围 ----
    const searchPosts = type === 'all' || type === 'posts';
    const searchTools = type === 'all' || type === 'tools';

    // ---- 帖子搜索：title 和 content 模糊匹配，status=PUBLISHED ----
    let posts: Array<{
      id: string;
      title: string;
      content: string;
      author: { username: string };
      category: { name: string } | null;
      createdAt: string;
    }> = [];
    let postsTotal = 0;

    if (searchPosts) {
      const postWhere = {
        status: 'PUBLISHED' as const,
        deletedAt: null,
        OR: [
          { title: { contains: q } },
          { content: { contains: q } },
        ],
      };

      const [postRows, postsCount] = await Promise.all([
        prisma.post.findMany({
          where: postWhere,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            author: { select: { username: true } },
            category: { select: { name: true } },
          },
        }),
        prisma.post.count({ where: postWhere }),
      ]);

      postsTotal = postsCount;
      posts = postRows.map((p) => ({
        id: p.id,
        title: p.title,
        // 截断 200 字符
        content:
          p.content.length > 200
            ? p.content.substring(0, 200) + '...'
            : p.content,
        author: { username: p.author?.username || '匿名' },
        category: p.category ? { name: p.category.name } : null,
        createdAt: p.createdAt.toISOString(),
      }));
    }

    // ---- 工具搜索：name 和 description 模糊匹配，isActive=true ----
    let tools: Array<{
      id: string;
      name: string;
      description: string | null;
      icon: string | null;
      url: string;
    }> = [];
    let toolsTotal = 0;

    if (searchTools) {
      const toolWhere = {
        isActive: true,
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      };

      const [toolRows, toolsCount] = await Promise.all([
        prisma.tool.findMany({
          where: toolWhere,
          orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            url: true,
          },
        }),
        prisma.tool.count({ where: toolWhere }),
      ]);

      toolsTotal = toolsCount;
      tools = toolRows.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        url: t.url,
      }));
    }

    const result = {
      posts,
      tools,
      total: postsTotal + toolsTotal,
      postsTotal,
      toolsTotal,
      page,
      limit,
      q,
    };

    // ---- 写入缓存 ----
    setCachedResult(cacheKey, result);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('[SEARCH ERROR]', error);
    return NextResponse.json(
      { error: '搜索失败，请稍后重试' },
      { status: 500 },
    );
  }
}
