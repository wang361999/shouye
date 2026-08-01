import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { sendNotification } from '@/lib/notify';

// ============ POST /api/forum/interact - 点赞/收藏 toggle ============
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
    const { postId, action } = body;

    // ---- 输入校验 ----
    if (!postId) {
      return NextResponse.json(
        { error: '帖子 ID 不能为空' },
        { status: 400 }
      );
    }

    if (!action || !['like', 'favorite'].includes(action)) {
      return NextResponse.json(
        { error: '无效的操作类型，请使用 like 或 favorite' },
        { status: 400 }
      );
    }

    // 检查帖子是否存在
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在' },
        { status: 404 }
      );
    }

    // ---- 处理点赞 ----
    if (action === 'like') {
      const existing = await prisma.like.findFirst({
        where: {
          userId: user.userId,
          postId,
          type: 'LIKE',
        },
      });

      if (existing) {
        // 已点赞 → 取消点赞
        await prisma.like.delete({ where: { id: existing.id } });
        await prisma.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        });
        return NextResponse.json({ liked: false });
      } else {
        // 未点赞 → 创建点赞
        await prisma.like.create({
          data: {
            userId: user.userId,
            postId,
            type: 'LIKE',
          },
        });
        await prisma.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        });

        // ---- 通知帖子作者被点赞（点赞者不是作者时） ----
        if (user.userId !== post.authorId) {
          await sendNotification({
            userId: post.authorId,
            type: 'like',
            title: '有人赞了您的帖子',
            content: `${user.username || '匿名用户'} 赞了您的帖子`,
            link: `/forum/post/${postId}`,
          });
        }

        return NextResponse.json({ liked: true });
      }
    }

    // ---- 处理收藏 ----
    if (action === 'favorite') {
      const existing = await prisma.like.findFirst({
        where: {
          userId: user.userId,
          postId,
          type: 'FAVORITE',
        },
      });

      if (existing) {
        // 已收藏 → 取消收藏
        await prisma.like.delete({ where: { id: existing.id } });
        return NextResponse.json({ favorited: false });
      } else {
        // 未收藏 → 创建收藏
        await prisma.like.create({
          data: {
            userId: user.userId,
            postId,
            type: 'FAVORITE',
          },
        });
        return NextResponse.json({ favorited: true });
      }
    }

    // 不应该到达这里
    return NextResponse.json(
      { error: '不支持的操作' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[INTERACT ERROR]', error);
    return NextResponse.json(
      { error: '操作失败' },
      { status: 500 }
    );
  }
}
