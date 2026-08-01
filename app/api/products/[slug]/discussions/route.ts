import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/products/[slug]/discussions
 * 获取该产品关联的论坛分类和帖子列表
 * 如果产品没有关联分类，返回空列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const { slug } = params;

    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!product) {
      return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    }

    // 查找产品关联的分类
    const category = await prisma.category.findFirst({
      where: { productId: product.id },
      select: { id: true, name: true, slug: true, icon: true, desc: true },
    });

    if (!category) {
      return NextResponse.json({
        category: null,
        posts: [],
        total: 0,
        message: '该项目尚未创建讨论区',
      });
    }

    // 获取该分类下的帖子
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: {
          categoryId: category.id,
          status: 'PUBLISHED',
          deletedAt: null,
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
            select: { id: true, username: true, avatar: true },
          },
          tags: {
            include: {
              tag: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      prisma.post.count({
        where: {
          categoryId: category.id,
          status: 'PUBLISHED',
          deletedAt: null,
        },
      }),
    ]);

    const postsWithSummary = posts.map((post) => ({
      ...post,
      summary:
        post.content.length > 200
          ? post.content.substring(0, 200) + '...'
          : post.content,
    }));

    return NextResponse.json({
      category,
      posts: postsWithSummary,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[PRODUCT DISCUSSIONS ERROR]', error);
    return NextResponse.json({ error: '获取讨论区失败' }, { status: 500 });
  }
}
