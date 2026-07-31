import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, adminAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// ============ GET /api/forum/posts - 获取帖子列表 ============
// 管理员（带 Authorization header）可通过 ?admin=1 获取全部帖子（含已删除/草稿）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const categorySlug = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    const authorId = searchParams.get('authorId') || undefined;
    const statusParam = searchParams.get('status') || undefined;
    const adminFlag = searchParams.get('admin') === '1';

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

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }

    if (authorId) {
      where.authorId = authorId;
    }

    // ---- 查询总数和分页数据 ----
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          { createdAt: 'desc' },
        ],
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
    }));

    return NextResponse.json({
      posts: postsWithSummary,
      total,
      page,
      totalPages: Math.ceil(total / limit),
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
    // 登录鉴权
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, content, categoryId } = body;

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

    // ---- 创建帖子 ----
    const post = await prisma.post.create({
      data: {
        title,
        content,
        authorId: user.userId,
        categoryId: categoryId || null,
        status: 'PUBLISHED',
      },
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
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('[POST CREATE ERROR]', error);
    return NextResponse.json(
      { error: '发布帖子失败' },
      { status: 500 }
    );
  }
}
