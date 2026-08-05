import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ============ GET /api/user/comments - 获取当前用户的评论列表 ============
// 支持 ?page=1&limit=20 分页
// 返回当前登录用户在所有帖子下的评论（包括子回复），按时间倒序
// 通过单次关联查询带出帖子标题，修复个人中心"我的评论"的 N+1 请求问题：
// 旧实现先拉取用户所有帖子，再逐帖请求评论接口过滤，此处改为一次查询完成。
//
// 注意：Prisma 的 Comment 模型没有 status 字段，软删除通过 deletedAt 标记，
// 因此过滤条件使用 deletedAt: null 而非 status。
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20', 10));

    // 查询当前用户的评论，带出帖子标题
    // authorId 命中顶层评论与子回复（子回复同样是 Comment 记录），故自动包含子回复
    const [total, comments] = await Promise.all([
      prisma.comment.count({
        where: {
          authorId: user.userId,
          deletedAt: null,
        },
      }),
      prisma.comment.findMany({
        where: {
          authorId: user.userId,
          deletedAt: null,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          post: {
            select: { id: true, title: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      comments: comments.map((c) => ({
        id: String(c.id),
        content: c.content,
        postId: String(c.post.id),
        postTitle: c.post.title,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      totalPages: Math.ceil(total / limit),
      page,
    });
  } catch (error) {
    console.error('[USER COMMENTS ERROR]', error);
    return NextResponse.json({ error: '获取评论失败' }, { status: 500 });
  }
}
