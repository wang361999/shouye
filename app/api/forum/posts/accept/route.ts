import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// 采纳答案奖励的声望值
const ACCEPT_REPUTATION_REWARD = 10;

// ============ POST /api/forum/posts/accept - 采纳评论作为答案 ============
// body: { commentId }
// 仅帖子作者可采纳；设置 post.acceptedCommentId 和 comment.isAccepted，
// 并给被采纳者 +10 声望
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
    const { commentId } = body;

    // ---- 输入校验 ----
    if (!commentId) {
      return NextResponse.json(
        { error: '评论 ID 不能为空' },
        { status: 400 }
      );
    }

    // ---- 查询评论及其所属帖子 ----
    const comment = await prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      include: {
        post: true,
      },
    });

    if (!comment) {
      return NextResponse.json(
        { error: '评论不存在' },
        { status: 404 }
      );
    }

    const post = comment.post;

    if (!post || post.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在' },
        { status: 404 }
      );
    }

    // 仅问答帖可采纳答案
    if (post.postType !== 'question') {
      return NextResponse.json(
        { error: '该帖子不是问答帖，无法采纳答案' },
        { status: 400 }
      );
    }

    // ---- 权限检查：只有帖子作者可以采纳（管理员亦可）----
    if (post.authorId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '只有帖子作者可以采纳答案' },
        { status: 403 }
      );
    }

    // ---- 事务：取消旧采纳 + 设置新采纳 + 声望奖励 ----
    await prisma.$transaction(async (tx) => {
      // 若已有其他被采纳的评论，先取消其采纳状态
      if (post.acceptedCommentId && post.acceptedCommentId !== commentId) {
        await tx.comment.update({
          where: { id: post.acceptedCommentId },
          data: { isAccepted: false },
        });
      }

      // 设置新采纳
      await tx.post.update({
        where: { id: post.id },
        data: { acceptedCommentId: commentId },
      });

      await tx.comment.update({
        where: { id: commentId },
        data: { isAccepted: true },
      });

      // 给被采纳者 +10 声望
      await tx.user.update({
        where: { id: comment.authorId },
        data: { reputation: { increment: ACCEPT_REPUTATION_REWARD } },
      });
    });

    return NextResponse.json({
      message: '答案已采纳',
      commentId,
      postId: post.id,
    });
  } catch (error) {
    console.error('[POST ACCEPT ERROR]', error);
    return NextResponse.json(
      { error: '采纳答案失败' },
      { status: 500 }
    );
  }
}
