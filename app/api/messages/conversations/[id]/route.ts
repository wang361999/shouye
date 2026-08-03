import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { sendNotification } from '@/lib/notify';

// 消息内容最大长度
const MAX_MESSAGE_LENGTH = 1000;

// ============ GET /api/messages/conversations/[id] - 获取会话中的消息列表 ============
// 分页参数: ?page=1&limit=50，按 createdAt 升序
// 验证当前用户是会话参与者，同时将会话中对方发送的未读消息标记为已读
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // ---- 登录鉴权 ----
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 },
      );
    }

    const conversationId = params.id;

    // ---- 验证会话存在且当前用户是参与者 ----
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: '会话不存在' },
        { status: 404 },
      );
    }

    const isParticipant =
      conversation.participant1Id === user.userId ||
      conversation.participant2Id === user.userId;

    if (!isParticipant) {
      return NextResponse.json(
        { error: '无权访问此会话' },
        { status: 403 },
      );
    }

    // ---- 解析分页参数 ----
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    // ---- 确定对方用户ID ----
    const otherUserId =
      conversation.participant1Id === user.userId
        ? conversation.participant2Id
        : conversation.participant1Id;

    // ---- 并行查询：消息列表 + 总数 + 标记已读 ----
    const [total, messages] = await Promise.all([
      prisma.message.count({ where: { conversationId } }),
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          sender: {
            select: { id: true, username: true, avatar: true },
          },
        },
      }),
    ]);

    // ---- 将对方发送的未读消息标记为已读 ----
    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: otherUserId,
        isRead: false,
      },
      data: { isRead: true },
    });

    // ---- 格式化返回数据 ----
    const data = messages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      content: msg.content,
      isRead: msg.isRead,
      createdAt: msg.createdAt.toISOString(),
      sender: {
        id: msg.sender.id,
        username: msg.sender.username,
        avatar: msg.sender.avatar,
      },
    }));

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[MESSAGES LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取消息列表失败' },
      { status: 500 },
    );
  }
}

// ============ POST /api/messages/conversations/[id] - 在会话中发送消息 ============
// body: { content }
// 验证当前用户是会话参与者。更新 conversation.lastMessageAt。通知对方有新消息
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // ---- 登录鉴权 ----
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 },
      );
    }

    const conversationId = params.id;

    // ---- 解析请求体 ----
    const body = await request.json();
    const content = (body.content || '').trim();

    if (!content) {
      return NextResponse.json(
        { error: '消息内容不能为空' },
        { status: 400 },
      );
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `消息内容不能超过 ${MAX_MESSAGE_LENGTH} 字符` },
        { status: 400 },
      );
    }

    // ---- 验证会话存在且当前用户是参与者 ----
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: '会话不存在' },
        { status: 404 },
      );
    }

    const isParticipant =
      conversation.participant1Id === user.userId ||
      conversation.participant2Id === user.userId;

    if (!isParticipant) {
      return NextResponse.json(
        { error: '无权在此会话中发送消息' },
        { status: 403 },
      );
    }

    // ---- 确定对方用户ID ----
    const otherUserId =
      conversation.participant1Id === user.userId
        ? conversation.participant2Id
        : conversation.participant1Id;

    // ---- 创建消息 ----
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.userId,
        content,
      },
      include: {
        sender: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    // ---- 更新会话最后消息时间 ----
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // ---- 通知对方有新消息 ----
    await sendNotification({
      userId: otherUserId,
      type: 'message',
      title: `${user.username} 给你发了一条私信`,
      content: content.length > 50 ? content.substring(0, 50) + '...' : content,
      link: `/messages?conv=${conversationId}`,
    });

    // ---- 返回创建的消息 ----
    return NextResponse.json({
      data: {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content,
        isRead: message.isRead,
        createdAt: message.createdAt.toISOString(),
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          avatar: message.sender.avatar,
        },
      },
    });
  } catch (error) {
    console.error('[MESSAGE SEND ERROR]', error);
    return NextResponse.json(
      { error: '发送消息失败' },
      { status: 500 },
    );
  }
}
