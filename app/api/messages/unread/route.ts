import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// ============ GET /api/messages/unread - 获取当前用户的未读消息总数 ============
// 用于 Header 显示 badge
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

    // ---- 获取当前用户参与的所有会话ID ----
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participant1Id: user.userId },
          { participant2Id: user.userId },
        ],
      },
      select: { id: true },
    });

    const conversationIds = conversations.map((c) => c.id);

    // ---- 没有会话时直接返回 0 ----
    if (conversationIds.length === 0) {
      return NextResponse.json({ unreadCount: 0 });
    }

    // ---- 统计未读消息总数（对方发送且未读的消息） ----
    const unreadCount = await prisma.message.count({
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: user.userId },
        isRead: false,
      },
    });

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error('[UNREAD MESSAGES ERROR]', error);
    return NextResponse.json(
      { error: '获取未读消息数失败' },
      { status: 500 },
    );
  }
}
