import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ============ 相关文章推荐 API ============
// 根据当前帖子的标签和分类，推荐相关的帖子
// 算法：同分类 + 标签匹配度排序，最多返回 5 篇
// 缓存：60 秒（相同帖子 ID 的推荐结果短时间内不变）

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 60_000; // 60 秒
const MAX_CACHE = 100;

function getCacheKey(postId: string, limit: number): string {
  return `${postId}:${limit}`;
}

function getCached(key: string): unknown | null {
  const item = cache.get(key);
  if (item && Date.now() < item.expiry) return item.data;
  if (item) cache.delete(key);
  return null;
}

function setCached(key: string, data: unknown): void {
  if (cache.size >= MAX_CACHE) {
    const keys = Array.from(cache.keys());
    const half = Math.floor(keys.length / 2);
    for (let i = 0; i < half; i++) cache.delete(keys[i]);
  }
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

// 计算两篇帖子的标签匹配度
function calcTagMatchScore(postTags: string[], targetTags: string[]): number {
  if (targetTags.length === 0 || postTags.length === 0) return 0;
  const targetSet = new Set(targetTags.map(t => t.toLowerCase()));
  let matches = 0;
  for (const tag of postTags) {
    if (targetSet.has(tag.toLowerCase())) matches++;
  }
  return matches;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const postId = params.id;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(10, Math.max(3, parseInt(searchParams.get('limit') || '5', 10)));

    const cacheKey = getCacheKey(postId, limit);
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached as Record<string, unknown>, {
        headers: { 'X-Cache': 'HIT' },
      });
    }

    // 1. 获取当前帖子的标签和分类
    const currentPost = await prisma.post.findUnique({
      where: { id: postId, status: 'PUBLISHED', deletedAt: null },
      select: {
        id: true,
        categoryId: true,
        createdAt: true,
        tags: {
          select: { tag: { select: { id: true, name: true } } },
        },
      },
    });

    if (!currentPost) {
      return NextResponse.json({ error: '帖子不存在' }, { status: 404 });
    }

    const currentTagNames = currentPost.tags.map(t => t.tag.name);
    const categoryId = currentPost.categoryId;

    // 2. 查询同分类下的其他已发布帖子
    const relatedPosts = await prisma.post.findMany({
      where: {
        id: { not: postId },
        status: 'PUBLISHED',
        deletedAt: null,
        categoryId: categoryId || undefined,
      },
      orderBy: [
        { isEssence: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 30, // 取 30 篇做排序
      select: {
        id: true,
        title: true,
        viewCount: true,
        commentCount: true,
        likeCount: true,
        isEssence: true,
        createdAt: true,
        category: { select: { name: true, slug: true } },
        tags: {
          select: { tag: { select: { name: true } } },
        },
      },
    });

    // 3. 按标签匹配度 + 热度综合排序
    const scored = relatedPosts.map(post => {
      const postTagNames = post.tags.map(t => t.tag.name);
      const tagMatchScore = calcTagMatchScore(postTagNames, currentTagNames);
      // 综合分数：标签匹配 * 10 + 精华 + 热度（评论*0.5 + 浏览*0.01）
      const heatScore = post.commentCount * 0.5 + post.viewCount * 0.01 + post.likeCount * 0.3;
      const totalScore = tagMatchScore * 10 + (post.isEssence ? 5 : 0) + heatScore * 0.1;
      return { post, score: totalScore, tagMatchCount: tagMatchScore };
    });

    // 按分数排序，取前 limit 个
    scored.sort((a, b) => b.score - a.score);
    const topPosts = scored.slice(0, limit).map(item => ({
      id: item.post.id,
      title: item.post.title,
      category: item.post.category,
      viewCount: item.post.viewCount,
      commentCount: item.post.commentCount,
      likeCount: item.post.likeCount,
      isEssence: item.post.isEssence,
      createdAt: item.post.createdAt,
      tagMatchCount: item.tagMatchCount,
    }));

    // 4. 查询上一篇/下一篇（同分类，按时间排序）
    const [prevPost, nextPost] = await Promise.all([
      // 上一篇：同分类中创建时间比当前早的最新一篇
      categoryId
        ? prisma.post.findFirst({
            where: {
              status: 'PUBLISHED',
              deletedAt: null,
              categoryId,
              createdAt: { lt: currentPost.createdAt },
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true, title: true },
          })
        : null,
      // 下一篇：同分类中创建时间比当前晚的最早一篇
      categoryId
        ? prisma.post.findFirst({
            where: {
              status: 'PUBLISHED',
              deletedAt: null,
              categoryId,
              createdAt: { gt: currentPost.createdAt },
            },
            orderBy: { createdAt: 'asc' },
            select: { id: true, title: true },
          })
        : null,
    ]);

    const result = {
      relatedPosts: topPosts,
      total: relatedPosts.length,
      algorithm: 'category_match + tag_similarity + heat_score',
      prevPost: prevPost || null,
      nextPost: nextPost || null,
    };

    setCached(cacheKey, result);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('[RELATED_POSTS ERROR]', error);
    return NextResponse.json(
      { error: '获取相关文章失败' },
      { status: 500 },
    );
  }
}
