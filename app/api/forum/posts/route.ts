import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, adminAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { revalidateCommunityHome } from '@/lib/revalidate';

// ============ GET /api/forum/posts - 获取帖子列表 ============
// 管理员（带 Authorization header）可通过 ?admin=1 获取全部帖子（含已删除/草稿）
// 支持 ?tag=xxx 按标签筛选、?postType=question|discussion 按类型筛选、?sort=latest|hot|essence
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

    // 构建排序规则：置顶始终在最前
    let orderBy: Prisma.PostOrderByWithRelationInput[];
    if (sort === 'hot') {
      // 热门排序：点赞数 + 浏览数
      orderBy = [
        { isPinned: 'desc' },
        { likeCount: 'desc' },
        { viewCount: 'desc' },
        { createdAt: 'desc' },
      ];
    } else {
      // 默认最新排序（essence 也走最新排序，仅过滤条件不同）
      orderBy = [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ];
    }

    // 判断是否为管理员请求
    const admin = adminAuth(request);
    const isAdmin = !!admin && !(admin instanceof Response) && adminFlag;

    // ---- 构建查询条件 ----
    const where: Prisma.PostWhereInput = {};

    // 非管理员只能看到已发布帖子
    if (!isAdmin) {
      where.status = 'PUBLISHED';
    } else if (statusParam) {
      // 管理员可按状态筛选
      where.status = statusParam as Prisma.EnumPostStatusFilter;
    }

    if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    // 搜索：同时搜索标题、内容和标签名
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { tags: { some: { tag: { name: { contains: search } } } } },
      ];
    }

    if (authorId) {
      where.authorId = authorId;
    }

    // 按标签筛选（通过 PostTag 关联查询，支持按 slug 或 name 匹配）
    if (tag) {
      where.tags = {
        some: {
          tag: {
            OR: [{ slug: tag }, { name: tag }],
          },
        },
      };
    }

    // 按帖子类型筛选
    if (postType) {
      where.postType = postType;
    }

    // essence：只看精华帖
    if (sort === 'essence') {
      where.isEssence = true;
    }

    // ---- 查询总数和分页数据 ----
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          // include tags：通过 PostTag include Tag
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      prisma.post.count({ where }),
    ]);

    // ---- 截断 content 用于列表展示 ----
    const postsWithSummary = posts.map((post) => ({
      ...post,
      // 取前 200 字作为摘要
      summary: post.content.length > 200
        ? post.content.substring(0, 200) + '...'
        : post.content,
      // 如果设置了自定义作者名，覆盖 author.username 用于前端显示
      author: post.authorName
        ? { ...post.author, username: post.authorName }
        : post.author,
    }));

    return NextResponse.json({
      posts: postsWithSummary,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }, {
      headers: {
        // 公开帖子列表缓存 60 秒，减少数据库查询
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
// 支持接收 tags(string[]) 和 postType('discussion'|'question')
// 发帖频率限制：同一用户 60 秒内只能发 1 帖
export async function POST(request: NextRequest) {
  try {
    // 登录鉴权
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, content, categoryId, tags, postType: rawPostType, authorName } = body;

    // ---- 输入校验 ----
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

    // 帖子类型校验：仅允许 discussion | question，默认 discussion
    const postType = rawPostType === 'question' ? 'question' : 'discussion';

    // authorName 仅管理员可设置（AI 自动发帖/周报用自定义显示名）
    const safeAuthorName = (user.role === 'ADMIN' && typeof authorName === 'string' && authorName.trim())
      ? authorName.trim().slice(0, 50)
      : undefined;

    // 标签校验：必须是字符串数组，去重并最多保留 5 个
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
        // 按 slug 去重，避免不同大小写/空格产生相同 slug 导致 PostTag 主键冲突
        if (seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);
        tagEntries.push({ name, slug });
        if (tagEntries.length >= 5) break;
      }
    }

    // 如果指定了分类，验证分类是否存在
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

    // ---- 发帖频率限制：同一用户 60 秒内只能发 1 帖 ----
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

    // ---- 创建帖子（含标签关联与用户计数更新，使用事务保证一致性）----
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

      // 处理标签：对每个标签名，查找或创建 Tag 记录，然后创建 PostTag 关联
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

      // 创建帖子后更新用户 postCount +1
      await tx.user.update({
        where: { id: user.userId },
        data: { postCount: { increment: 1 } },
      });

      return post;
    });

    // 查询带关联（author/category/tags）的帖子数据返回
    const post = await prisma.post.findUnique({
      where: { id: created.id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    // 清除社区首页缓存，使新帖及时在首页展示
    revalidateCommunityHome();

    // 如果设置了自定义作者名，覆盖 author.username 用于前端显示
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
