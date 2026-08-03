import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// ============ GET /api/messages/conversations - 获取当前用户的所有会话列表 ============
// 按 lastMessageAt 降序排列（无消息的会话按 createdAt 降序排在后面）
// 每个会话返回: 对方用户信息(id, username, avatar)、最后一条消息(content, createdAt)、未读消息数
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

    // ---- 查询当前用户参与的所有会话 ----
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { participant1Id: user.userId },
          { participant2Id: user.userId },
        ],
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        participant1: {
          select: { id: true, username: true, avatar: true },
        },
        participant2: {
          select: { id: true, username: true, avatar: true },
        },
        // 只取最后一条消息
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, createdAt: true, senderId: true },
        },
      },
    });

    // ---- 批量查询每个会话的未读消息数 ----
    const conversationIds = conversations.map((c) => c.id);
    const unreadCounts = conversationIds.length
      ? await prisma.message.groupBy({
          by: ['conversationId'],
          where: {
            conversationId: { in: conversationIds },
            senderId: { not: user.userId },
            isRead: false,
          },
          _count: { _all: true },
        })
      : [];

    const unreadMap = new Map(
      unreadCounts.map((item) => [item.conversationId, item._count._all]),
    );

    // ---- 格式化返回数据 ----
    const data = conversations.map((conv) => {
      const isParticipant1 = conv.participant1Id === user.userId;
      const otherUser = isParticipant1 ? conv.participant2 : conv.participant1;
      const lastMessage = conv.messages[0] || null;

      return {
        id: conv.id,
        otherUser: {
          id: otherUser.id,
          username: otherUser.username,
          avatar: otherUser.avatar,
        },
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt.toISOString(),
              senderId: lastMessage.senderId,
            }
          : null,
        unreadCount: unreadMap.get(conv.id) || 0,
        lastMessageAt: conv.lastMessageAt?.toISOString() || null,
        createdAt: conv.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[CONVERSATIONS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取会话列表失败' },
      { status: 500 },
    );
  }
}

// ============ POST /api/messages/conversations - 发起新会话 ============
// body: { targetUserId }
// 按 cuid 字符串排序确保 participant1Id < participant2Id，使唯一约束生效
// 如果已有会话则直接返回已有会话
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
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: '请提供目标用户ID' },
        { status: 400 },
      );
    }

    // ---- 不能与自己发起会话 ----
    if (String(targetUserId) === user.userId) {
      return NextResponse.json(
        { error: '不能与自己发起会话' },
        { status: 400 },
      );
    }

    // ---- 验证目标用户存在 ----
    const targetUser = await prisma.user.findUnique({
      where: { id: String(targetUserId) },
      select: { id: true, username: true, avatar: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: '目标用户不存在' },
        { status: 404 },
      );
    }

    // ---- 按 cuid 字符串排序，小的作为 participant1Id ----
    const [participant1Id, participant2Id] = [user.userId, String(targetUserId)].sort();

    // ---- 查找是否已有会话（唯一约束: participant1Id + participant2Id） ----
    const existing = await prisma.conversation.findUnique({
      where: {
        participant1Id_participant2Id: {
          participant1Id,
          participant2Id,
        },
      },
    });

    if (existing) {
      // 直接返回已有会话
      return NextResponse.json({
        id: existing.id,
        otherUser: {
          id: targetUser.id,
          username: targetUser.username,
          avatar: targetUser.avatar,
        },
        lastMessage: null,
        unreadCount: 0,
        lastMessageAt: existing.lastMessageAt?.toISOString() || null,
        createdAt: existing.createdAt.toISOString(),
      });
    }

    // ---- 创建新会话 ----
    const conversation = await prisma.conversation.create({
      data: {
        participant1Id,
        participant2Id,
        lastMessageAt: new Date(),
      },
    });

    return NextResponse.json({
      id: conversation.id,
      otherUser: {
        id: targetUser.id,
        username: targetUser.username,
        avatar: targetUser.avatar,
      },
      lastMessage: null,
      unreadCount: 0,
      lastMessageAt: conversation.lastMessageAt?.toISOString() || null,
      createdAt: conversation.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('[CONVERSATION CREATE ERROR]', error);
    return NextResponse.json(
      { error: '创建会话失败' },
      { status: 500 },
    );
  }
}
