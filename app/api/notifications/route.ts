import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// ============ 通知类型说明 ============
// type 字段取值：
//   - reply  回复（有人回复了你的帖子/评论）
//   - like   点赞（有人点赞了你的帖子/评论）
//   - system 系统（系统通知）
//   - mention 提及（有人 @ 了你）
//
// 通知在评论和点赞时自动创建（由评论 API 和点赞 API 触发），
// 本接口仅负责通知的查询和标记已读，不修改现有评论/点赞 API。

// ============ GET /api/notifications - 获取当前用户的通知列表 ============
// 分页参数：?page=1&limit=20
// 返回：{ data: [...], total, unreadCount, page, totalPages }
export async function GET(request: NextRequest) {
  try {
    // ---- 登录鉴权 ----
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 },
      );
    }

    // ---- 解析分页参数 ----
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    // ---- 构建查询条件 ----
    const where = { userId: user.userId };

    // ---- 并行查询：列表、总数、未读数 ----
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: user.userId, isRead: false },
      }),
    ]);

    return NextResponse.json({
      data: notifications,
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[NOTIFICATIONS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取通知列表失败' },
      { status: 500 },
    );
  }
}

// ============ POST /api/notifications - 标记通知为已读 ============
// body: { notificationId } 标记单条为已读
//    或 { all: true } 标记全部为已读
export async function POST(request: NextRequest) {
  try {
    // ---- 登录鉴权 ----
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 },
      );
    }

    // ---- 解析请求体 ----
    const body = await request.json();
    const { notificationId, all } = body;

    // ---- 标记全部为已读 ----
    if (all === true) {
      const result = await prisma.notification.updateMany({
        where: { userId: user.userId, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({
        message: '已将全部通知标记为已读',
        updated: result.count,
      });
    }

    // ---- 标记单条为已读 ----
    if (notificationId) {
      // 校验通知归属当前用户
      const notification = await prisma.notification.findFirst({
        where: { id: String(notificationId), userId: user.userId },
      });
      if (!notification) {
        return NextResponse.json(
          { error: '通知不存在或无权操作' },
          { status: 404 },
        );
      }

      // 仅当未读时更新
      if (!notification.isRead) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: { isRead: true },
        });
      }

      return NextResponse.json({
        message: '通知已标记为已读',
      });
    }

    return NextResponse.json(
      { error: '请提供 notificationId 或 all 参数' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[NOTIFICATIONS MARK READ ERROR]', error);
    return NextResponse.json(
      { error: '标记已读失败' },
      { status: 500 },
    );
  }
}
