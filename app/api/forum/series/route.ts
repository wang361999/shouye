import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ============ 系列文章检测 API ============
// 自动从帖子标题中检测系列文章并分组
// 支持模式：
//   - "系列名（一）：标题"、"系列名（二）：标题"
//   - "系列名 第X篇：标题"
//   - "系列名 之X：标题"

const CACHE = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 分钟

// 提取系列名和序号的正则模式
const SERIES_PATTERNS = [
  // 模式1：XXX（一）：标题 或 XXX（一）标题
  {
    regex: /^(.+?)（([一二三四五六七八九十百千零\d]+)）[：:]?\s*(.+)$/,
    getSeries: (m: RegExpMatchArray) => m[1].trim(),
    getPart: (m: RegExpMatchArray) => m[2],
    getTitle: (m: RegExpMatchArray) => m[3].trim(),
  },
  // 模式2：XXX 第X篇：标题
  {
    regex: /^(.+?)\s*第([一二三四五六七八九十百千零\d]+)篇[：:]?\s*(.+)$/,
    getSeries: (m: RegExpMatchArray) => m[1].trim(),
    getPart: (m: RegExpMatchArray) => `第${m[2]}篇`,
    getTitle: (m: RegExpMatchArray) => m[3].trim(),
  },
  // 模式3：XXX 之X：标题
  {
    regex: /^(.+?)\s*之([一二三四五六七八九十百千\d]+)[：:]?\s*(.+)$/,
    getSeries: (m: RegExpMatchArray) => m[1].trim(),
    getPart: (m: RegExpMatchArray) => `之${m[2]}`,
    getTitle: (m: RegExpMatchArray) => m[3].trim(),
  },
];

// 中文数字转阿拉伯数字（用于排序）
const CN_NUM_MAP: Record<string, number> = {
  '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '百': 100, '千': 1000,
};

function cnToNum(cn: string): number {
  // 纯阿拉伯数字
  if (/^\d+$/.test(cn)) return parseInt(cn, 10);

  // 简单中文数字（十以内）
  if (cn.length === 1 && CN_NUM_MAP[cn] !== undefined) return CN_NUM_MAP[cn];

  // "十X" 格式
  if (cn.startsWith('十') && cn.length === 2) {
    return 10 + (CN_NUM_MAP[cn[1]] || 0);
  }

  // "X十" 格式
  if (cn.endsWith('十') && cn.length === 2) {
    return (CN_NUM_MAP[cn[0]] || 0) * 10;
  }

  // "X十Y" 格式
  if (cn.length === 3 && cn[1] === '十') {
    return (CN_NUM_MAP[cn[0]] || 0) * 10 + (CN_NUM_MAP[cn[2]] || 0);
  }

  // 尝试从 part 字符串中提取数字
  const numMatch = cn.match(/\d+/);
  if (numMatch) return parseInt(numMatch[0], 10);

  return 0;
}

interface SeriesPost {
  id: string;
  title: string;
  partLabel: string;
  partNumber: number;
  subTitle: string;
  createdAt: string;
  viewCount: number;
  commentCount: number;
  author: { username: string; avatar: string | null };
  category: { name: string; slug: string } | null;
}

interface SeriesGroup {
  id: string;
  name: string;
  postCount: number;
  posts: SeriesPost[];
  firstPostAt: string;
  lastPostAt: string;
  totalViews: number;
}

function detectSeriesFromTitle(title: string): { seriesName: string; partLabel: string; subTitle: string; partNumber: number } | null {
  for (const pattern of SERIES_PATTERNS) {
    const match = title.match(pattern.regex);
    if (match) {
      const seriesName = pattern.getSeries(match);
      const partLabel = pattern.getPart(match);
      const subTitle = pattern.getTitle(match);
      const partNumber = cnToNum(partLabel.replace(/[第篇之]/g, ''));

      // 系列名太短的忽略（可能是误匹配）
      if (seriesName.length < 2) continue;

      return { seriesName, partLabel, subTitle, partNumber };
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const cacheKey = 'forum-series';
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return NextResponse.json(cached.data as Record<string, unknown>, {
        headers: { 'X-Cache': 'HIT' },
      });
    }

    // 查询最近的已发布帖子（最多 200 篇做检测）
    const posts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        title: true,
        createdAt: true,
        viewCount: true,
        commentCount: true,
        author: { select: { username: true, avatar: true } },
        category: { select: { name: true, slug: true } },
      },
    });

    // 按系列分组
    const seriesMap = new Map<string, SeriesPost[]>();

    for (const post of posts) {
      const detected = detectSeriesFromTitle(post.title);
      if (!detected) continue;

      const seriesPost: SeriesPost = {
        id: post.id,
        title: post.title,
        partLabel: detected.partLabel,
        partNumber: detected.partNumber,
        subTitle: detected.subTitle,
        createdAt: post.createdAt.toISOString(),
        viewCount: Number(post.viewCount) || 0,
        commentCount: Number(post.commentCount) || 0,
        author: {
          username: post.author?.username || '匿名',
          avatar: post.author?.avatar || null,
        },
        category: post.category
          ? { name: post.category.name, slug: post.category.slug }
          : null,
      };

      if (!seriesMap.has(detected.seriesName)) {
        seriesMap.set(detected.seriesName, []);
      }
      seriesMap.get(detected.seriesName)!.push(seriesPost);
    }

    // 转换为数组并排序
    const seriesList: SeriesGroup[] = [];

    for (const [name, seriesPosts] of seriesMap) {
      // 只保留至少有 2 篇的系列
      if (seriesPosts.length < 2) continue;

      // 按序号排序
      seriesPosts.sort((a, b) => a.partNumber - b.partNumber);

      const totalViews = seriesPosts.reduce((sum, p) => sum + p.viewCount, 0);

      seriesList.push({
        id: name,
        name,
        postCount: seriesPosts.length,
        posts: seriesPosts,
        firstPostAt: seriesPosts[0].createdAt,
        lastPostAt: seriesPosts[seriesPosts.length - 1].createdAt,
        totalViews,
      });
    }

    // 按文章数量和总浏览量排序
    seriesList.sort((a, b) => {
      if (b.postCount !== a.postCount) return b.postCount - a.postCount;
      return b.totalViews - a.totalViews;
    });

    const result = {
      series: seriesList,
      total: seriesList.length,
      algorithm: 'auto-detect-from-titles',
    };

    CACHE.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('[SERIES API ERROR]', error);
    return NextResponse.json(
      { error: '获取系列文章失败' },
      { status: 500 }
    );
  }
}
