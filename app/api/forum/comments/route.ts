import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, adminAuth } from '@/lib/auth';
import { sendNotification } from '@/lib/notify';

// ============ 简单敏感词列表 ============
const SENSITIVE_WORDS = [
  '赌博', '色情', '诈骗', '传销', '代开发票', '假币', '毒品',
  '枪支', '办证', '套现', '刷单', '兼职群', '加微信',
];

// ============ 敏感词检测函数 ============
function containsSensitiveWord(text: string): boolean {
  return SENSITIVE_WORDS.some((word) => text.includes(word));
}

// ============ GET /api/forum/comments - 获取评论列表 ============
// 模式1: ?postId=xxx - 获取指定帖子评论树（前台用）
// 模式2: ?approved=true|false|all - 管理后台查询评论（需管理员权限）
//        - approved=true: 已通过审核
//        - approved=false: 待审核
//        - approved=all: 全部评论
//        可附加 ?postId=&search=&page=&limit= 进行筛选
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const approved = searchParams.get('approved');

    // ---- 模式1：按 postId 查询帖子评论树 ----
    if (postId && approved === null) {
      const where: Record<string, unknown> = {
        postId,
        parentId: null,
        deletedAt: null,
      };

      // 查询顶级评论（parentId 为 null）
      const comments = await prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
          replies: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json(comments);
    }

    // ---- 模式2：管理后台查询评论列表 ----
    if (approved === 'false' || approved === 'true' || approved === 'all') {
      // admin 鉴权
      const admin = adminAuth(request);
      if (admin instanceof Response) return admin;

      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '20', 10);
      const search = searchParams.get('search') || undefined;

      const where: Record<string, unknown> = {
        deletedAt: null,
      };

      // 按审核状态筛选
      if (approved === 'true' || approved === 'false') {
        where.isApproved = approved === 'true';
      }

      // 按帖子筛选
      if (postId) {
        where.postId = postId;
      }

      // 关键词搜索（评论内容）
      if (search) {
        where.content = { contains: search };
      }

      const [total, comments] = await Promise.all([
        prisma.comment.count({ where }),
        prisma.comment.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            post: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return NextResponse.json({
        data: comments,
        total,
        page,
        totalPages,
      });
    }

    return NextResponse.json(
      { error: '缺少查询参数，需要 postId 或 approved' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[COMMENTS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取评论列表失败' },
      { status: 500 }
    );
  }
}

// ============ PATCH /api/forum/comments - 审核评论（管理员） ============
// body: { commentId, action: 'approve' }
export async function PATCH(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { commentId, action } = body;

    if (!commentId) {
      return NextResponse.json(
        { error: '缺少评论 ID' },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });

    if (!comment) {
      return NextResponse.json(
        { error: '评论不存在' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      const updated = await prisma.comment.update({
        where: { id: commentId },
        data: { isApproved: true },
      });

      // 如果之前未通过审核，现在通过，则帖子评论数 +1
      if (!comment.isApproved) {
        await prisma.post.update({
          where: { id: comment.postId },
          data: { commentCount: { increment: 1 } },
        });
      }

      return NextResponse.json({
        message: '评论已通过审核',
        isApproved: updated.isApproved,
      });
    }

    return NextResponse.json(
      { error: '不支持的操作，请使用 approve' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[COMMENT PATCH ERROR]', error);
    return NextResponse.json(
      { error: '审核操作失败' },
      { status: 500 }
    );
  }
}

// ============ POST /api/forum/comments - 发表评论 ============
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
    const { content, postId, parentId } = body;

    // ---- 输入校验 ----
    if (!content || !postId) {
      return NextResponse.json(
        { error: '评论内容和帖子 ID 不能为空' },
        { status: 400 }
      );
    }

    if (!content.trim()) {
      return NextResponse.json(
        { error: '评论内容不能为空白' },
        { status: 400 }
      );
    }

    // 检查帖子是否存在
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post || post.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在' },
        { status: 404 }
      );
    }

    // 检查帖子是否被锁定（管理员可评论）
    if (post.isLocked && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '帖子已锁定，禁止评论' },
        { status: 403 }
      );
    }

    // 如果指定了父评论，验证父评论是否存在且属于同一帖子
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
      });
      if (!parentComment || parentComment.postId !== postId) {
        return NextResponse.json(
          { error: '父评论不存在或不属于该帖子' },
          { status: 400 }
        );
      }
    }

    // ---- 自动审核：简单敏感词过滤，命中则 isApproved=false ----
    const isApproved = !containsSensitiveWord(content.trim());

    // ---- 创建评论 ----
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        postId,
        authorId: user.userId,
        parentId: parentId || null,
        isApproved,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // 只有审核通过的评论才计入帖子评论数
    if (isApproved) {
      await prisma.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });
    }

    // ---- 通知帖子作者有新回复（评论者不是作者时） ----
    if (user.userId !== post.authorId) {
      const commentSummary =
        content.trim().length > 50
          ? `${content.trim().slice(0, 50)}...`
          : content.trim();
      await sendNotification({
        userId: post.authorId,
        type: 'reply',
        title: '您的帖子有新回复',
        content: `${user.username || '匿名用户'} 回复了您：${commentSummary}`,
        link: `/forum/post/${postId}`,
      });
    }

    // 如果评论被标记为待审核，返回提示信息
    if (!isApproved) {
      return NextResponse.json(
        {
          ...comment,
          message: '评论包含敏感内容，已提交待审核',
        },
        { status: 201 }
      );
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('[COMMENT CREATE ERROR]', error);
    return NextResponse.json(
      { error: '发表评论失败' },
      { status: 500 }
    );
  }
}

// ============ DELETE /api/forum/comments - 删除评论 ============
// 通过 body.commentId 指定要删除的评论，合并到同一文件节省函数名额
export async function DELETE(request: NextRequest) {
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
        { error: '缺少评论 ID' },
        { status: 400 }
      );
    }

    // 检查评论是否存在（排除已软删除的）
    const comment = await prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });

    if (!comment) {
      return NextResponse.json(
        { error: '评论不存在' },
        { status: 404 }
      );
    }

    // 权限检查：评论作者本人或管理员
    if (comment.authorId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权删除此评论' },
        { status: 403 }
      );
    }

    // 检查是否有未删除的子评论
    const repliesCount = await prisma.comment.count({
      where: { parentId: commentId, deletedAt: null },
    });

    if (repliesCount > 0) {
      return NextResponse.json(
        { error: '该评论下还有回复，无法删除。请先删除所有回复' },
        { status: 400 }
      );
    }

    // ---- 软删除评论（设置 deletedAt） ----
    await prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    // 仅审核通过的评论才更新帖子评论数 -1
    if (comment.isApproved) {
      await prisma.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      });
    }

    return NextResponse.json({ message: '评论已删除' });
  } catch (error) {
    console.error('[COMMENT DELETE ERROR]', error);
    return NextResponse.json(
      { error: '删除评论失败' },
      { status: 500 }
    );
  }
}
