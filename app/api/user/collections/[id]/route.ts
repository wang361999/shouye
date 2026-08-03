import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ============ GET /api/user/collections/[id] - 获取收藏夹详情 + 分页收藏的帖子列表 ============
// 查询参数: ?page=1&limit=20
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 },
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: '无效的收藏夹 ID' },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10), 1),
      50,
    );

    // ---- 查询收藏夹基础信息（含所有权校验）----
    const collection = await prisma.collection.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        name: true,
        description: true,
        isPublic: true,
        itemCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: '收藏夹不存在' },
        { status: 404 },
      );
    }

    // 权限校验：仅拥有者（或管理员）可查看自己的收藏夹详情
    if (collection.userId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权访问该收藏夹' },
        { status: 403 },
      );
    }

    // ---- 分页查询收藏的帖子列表 ----
    const where = {
      collectionId: id,
      post: { status: 'PUBLISHED' },
    };

    const [items, total] = await Promise.all([
      prisma.collectionItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          post: {
            select: {
              id: true,
              title: true,
              content: true,
              createdAt: true,
              viewCount: true,
              likeCount: true,
              commentCount: true,
              isPinned: true,
              isEssence: true,
              postType: true,
              author: {
                select: { id: true, username: true, avatar: true },
              },
              category: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
        },
      }),
      prisma.collectionItem.count({ where }),
    ]);

    // 格式化帖子列表
    const posts = items.map((item) => ({
      itemId: item.id,
      collectedAt: item.createdAt,
      id: item.post.id,
      title: item.post.title,
      summary:
        item.post.content.length > 200
          ? item.post.content.substring(0, 200) + '...'
          : item.post.content,
      createdAt: item.post.createdAt,
      viewCount: item.post.viewCount,
      likeCount: item.post.likeCount,
      commentCount: item.post.commentCount,
      isPinned: item.post.isPinned,
      isEssence: item.post.isEssence,
      postType: item.post.postType,
      author: {
        id: item.post.author.id,
        username: item.post.author.username,
        avatar: item.post.author.avatar,
      },
      category: item.post.category
        ? {
            id: item.post.category.id,
            name: item.post.category.name,
            slug: item.post.category.slug,
          }
        : null,
    }));

    return NextResponse.json({
      collection: {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        isPublic: collection.isPublic,
        itemCount: collection.itemCount,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      },
      posts,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error('[COLLECTION DETAIL ERROR]', error);
    return NextResponse.json(
      { error: '获取收藏夹详情失败' },
      { status: 500 },
    );
  }
}

// ============ PUT /api/user/collections/[id] - 更新收藏夹 ============
// body: { name?, description?, isPublic? }
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 },
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: '无效的收藏夹 ID' },
        { status: 400 },
      );
    }

    // ---- 查询收藏夹并校验所有权 ----
    const existing = await prisma.collection.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '收藏夹不存在' },
        { status: 404 },
      );
    }

    if (existing.userId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权修改该收藏夹' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { name, description, isPublic } = body;

    // ---- 构建更新数据 ----
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return NextResponse.json(
          { error: '收藏夹名称不能为空' },
          { status: 400 },
        );
      }
      if (trimmedName.length > 50) {
        return NextResponse.json(
          { error: '收藏夹名称不能超过 50 个字符' },
          { status: 400 },
        );
      }
      updateData.name = trimmedName;
    }

    if (description !== undefined) {
      const trimmedDescription = String(description ?? '').trim();
      if (trimmedDescription.length > 200) {
        return NextResponse.json(
          { error: '收藏夹描述不能超过 200 个字符' },
          { status: 400 },
        );
      }
      updateData.description = trimmedDescription || null;
    }

    if (isPublic !== undefined) {
      if (typeof isPublic !== 'boolean') {
        return NextResponse.json(
          { error: 'isPublic 必须为布尔值' },
          { status: 400 },
        );
      }
      updateData.isPublic = isPublic;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '没有需要更新的字段' },
        { status: 400 },
      );
    }

    // ---- 执行更新 ----
    const updated = await prisma.collection.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[COLLECTION UPDATE ERROR]', error);
    return NextResponse.json(
      { error: '更新收藏夹失败' },
      { status: 500 },
    );
  }
}

// ============ DELETE /api/user/collections/[id] - 删除收藏夹 ============
// 级联删除 CollectionItem（schema 中已定义 onDelete: Cascade）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 },
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: '无效的收藏夹 ID' },
        { status: 400 },
      );
    }

    // ---- 查询收藏夹并校验所有权 ----
    const existing = await prisma.collection.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '收藏夹不存在' },
        { status: 404 },
      );
    }

    if (existing.userId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权删除该收藏夹' },
        { status: 403 },
      );
    }

    // ---- 删除收藏夹（CollectionItem 由 onDelete: Cascade 自动级联删除）----
    await prisma.collection.delete({ where: { id } });

    return NextResponse.json({ message: '收藏夹已删除' });
  } catch (error) {
    console.error('[COLLECTION DELETE ERROR]', error);
    return NextResponse.json(
      { error: '删除收藏夹失败' },
      { status: 500 },
    );
  }
}
