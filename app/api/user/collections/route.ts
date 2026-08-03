import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ============ GET /api/user/collections - 获取当前用户的收藏夹列表 ============
// 每个收藏夹包含 itemCount 和最近收藏的帖子摘要（取前 3 个）
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 },
      );
    }

    const collections = await prisma.collection.findMany({
      where: { userId: user.userId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        items: {
          // 仅返回已发布帖子的收藏项，过滤掉软删除的帖子
          where: { post: { status: 'PUBLISHED' } },
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: {
            post: {
              select: {
                id: true,
                title: true,
                createdAt: true,
                author: {
                  select: { id: true, username: true, avatar: true },
                },
              },
            },
          },
        },
      },
    });

    // 格式化返回数据
    const data = collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isPublic: collection.isPublic,
      itemCount: collection.itemCount,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      recentPosts: collection.items.map((item) => ({
        id: item.post.id,
        title: item.post.title,
        createdAt: item.post.createdAt,
        collectedAt: item.createdAt,
        author: {
          id: item.post.author.id,
          username: item.post.author.username,
          avatar: item.post.author.avatar,
        },
      })),
    }));

    return NextResponse.json({ collections: data, total: data.length });
  } catch (error) {
    console.error('[COLLECTIONS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取收藏夹列表失败' },
      { status: 500 },
    );
  }
}

// ============ POST /api/user/collections - 创建新收藏夹 ============
// body: { name, description?, isPublic? }
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { name, description, isPublic } = body;

    // ---- 输入校验 ----
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: '收藏夹名称不能为空' },
        { status: 400 },
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      return NextResponse.json(
        { error: '收藏夹名称不能超过 50 个字符' },
        { status: 400 },
      );
    }

    const trimmedDescription =
      typeof description === 'string' && description.trim()
        ? description.trim().slice(0, 200)
        : null;

    const isPublicValue = typeof isPublic === 'boolean' ? isPublic : true;

    // ---- 创建收藏夹 ----
    const collection = await prisma.collection.create({
      data: {
        userId: user.userId,
        name: trimmedName,
        description: trimmedDescription,
        isPublic: isPublicValue,
      },
    });

    return NextResponse.json(collection, { status: 201 });
  } catch (error) {
    console.error('[COLLECTION CREATE ERROR]', error);
    return NextResponse.json(
      { error: '创建收藏夹失败' },
      { status: 500 },
    );
  }
}
