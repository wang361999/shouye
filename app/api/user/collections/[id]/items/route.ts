import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// ============ GET /api/user/collections/[id]/items - 检查帖子是否已收藏 ============
// 查询参数: ?postId=xxx → 返回该帖子被收藏进的所有收藏夹列表
// 注意：此接口针对 [id] 路由，会校验该收藏夹是否包含指定帖子，
//       同时返回用户所有包含该帖子的收藏夹，便于前端展示收藏状态。
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
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json(
        { error: '缺少 postId 参数' },
        { status: 400 },
      );
    }

    // 查询当前用户所有包含该帖子的收藏夹
    const collections = await prisma.collection.findMany({
      where: {
        userId: user.userId,
        items: { some: { postId } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        isPublic: true,
        itemCount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      collections,
      collected: collections.some((c) => c.id === id),
    });
  } catch (error) {
    console.error('[COLLECTION ITEM CHECK ERROR]', error);
    return NextResponse.json(
      { error: '检查收藏状态失败' },
      { status: 500 },
    );
  }
}

// ============ POST /api/user/collections/[id]/items - 添加帖子到收藏夹 ============
// body: { postId }
// 同时更新 collection.itemCount
export async function POST(
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

    const body = await request.json();
    const { postId } = body;

    if (!postId || typeof postId !== 'string') {
      return NextResponse.json(
        { error: '缺少 postId 参数' },
        { status: 400 },
      );
    }

    // ---- 校验收藏夹归属 ----
    const collection = await prisma.collection.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!collection) {
      return NextResponse.json(
        { error: '收藏夹不存在' },
        { status: 404 },
      );
    }

    if (collection.userId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权操作该收藏夹' },
        { status: 403 },
      );
    }

    // ---- 校验帖子存在且未删除 ----
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    });

    if (!post || post.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在' },
        { status: 404 },
      );
    }

    // ---- 事务：创建收藏项 + 更新 itemCount ----
    try {
      const item = await prisma.$transaction(async (tx) => {
        const created = await tx.collectionItem.create({
          data: {
            collectionId: id,
            postId,
          },
        });

        await tx.collection.update({
          where: { id },
          data: { itemCount: { increment: 1 } },
        });

        return created;
      });

      return NextResponse.json(
        { message: '已加入收藏夹', itemId: item.id },
        { status: 201 },
      );
    } catch (err) {
      // 唯一约束冲突 → 该帖子已在收藏夹中
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return NextResponse.json(
          { error: '该帖子已在收藏夹中' },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (error) {
    console.error('[COLLECTION ITEM ADD ERROR]', error);
    return NextResponse.json(
      { error: '添加到收藏夹失败' },
      { status: 500 },
    );
  }
}

// ============ DELETE /api/user/collections/[id]/items - 从收藏夹移除帖子 ============
// body: { postId } 或 query: ?postId=xxx
// 同时更新 collection.itemCount
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

    // ---- 解析 postId：优先请求体，回退查询参数 ----
    let postId: string | undefined;
    try {
      const body = await request.json();
      postId = body?.postId;
    } catch {
      // DELETE 请求体可能为空，回退到查询参数
    }

    if (!postId) {
      const { searchParams } = new URL(request.url);
      postId = searchParams.get('postId') || undefined;
    }

    if (!postId || typeof postId !== 'string') {
      return NextResponse.json(
        { error: '缺少 postId 参数' },
        { status: 400 },
      );
    }

    // ---- 校验收藏夹归属 ----
    const collection = await prisma.collection.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!collection) {
      return NextResponse.json(
        { error: '收藏夹不存在' },
        { status: 404 },
      );
    }

    if (collection.userId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权操作该收藏夹' },
        { status: 403 },
      );
    }

    // ---- 事务：删除收藏项 + 更新 itemCount ----
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.collectionItem.deleteMany({
        where: { collectionId: id, postId },
      });

      if (deleted.count > 0) {
        await tx.collection.update({
          where: { id },
          data: {
            itemCount: { decrement: deleted.count },
          },
        });
      }

      return deleted;
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: '该帖子不在收藏夹中' },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: '已移出收藏夹' });
  } catch (error) {
    console.error('[COLLECTION ITEM REMOVE ERROR]', error);
    return NextResponse.json(
      { error: '从收藏夹移除失败' },
      { status: 500 },
    );
  }
}
