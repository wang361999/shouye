import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// 允许的关注类型
const ALLOWED_TYPES = ['user', 'category'];

// ============ GET /api/forum/follows - 获取当前用户关注列表 ============
// ?type=user|category 指定关注的类型
export async function GET(request: NextRequest) {
  try {
    // 登录鉴权
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;

    const where: Record<string, unknown> = {
      followerId: user.userId,
    };

    if (type === 'user') {
      where.followingId = { not: null };
    } else if (type === 'category') {
      where.categoryId = { not: null };
    }

    const follows = await prisma.follow.findMany({
      where,
      orderBy: { id: 'desc' },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            avatar: true,
            bio: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
      },
    });

    return NextResponse.json(follows);
  } catch (error) {
    console.error('[FOLLOWS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取关注列表失败' },
      { status: 500 }
    );
  }
}

// ============ POST /api/forum/follows - 关注/取消关注（toggle） ============
// body: { type: 'user'|'category', targetId }
// 已关注则取消，未关注则添加，返回 { following: boolean }
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
    const { type, targetId } = body;

    // ---- 输入校验 ----
    if (!type || !targetId) {
      return NextResponse.json(
        { error: '关注类型和目标 ID 不能为空' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json(
        { error: '无效的关注类型，仅支持 user 或 category' },
        { status: 400 }
      );
    }

    // 不能关注自己
    if (type === 'user' && targetId === user.userId) {
      return NextResponse.json(
        { error: '不能关注自己' },
        { status: 400 }
      );
    }

    // ---- 校验目标是否存在 ----
    if (type === 'user') {
      const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
      if (!targetUser) {
        return NextResponse.json(
          { error: '关注的用户不存在' },
          { status: 404 }
        );
      }
    } else {
      const category = await prisma.category.findUnique({ where: { id: targetId } });
      if (!category) {
        return NextResponse.json(
          { error: '关注的分类不存在' },
          { status: 404 }
        );
      }
    }

    // ---- 查询是否已关注 ----
    const existing = type === 'user'
      ? await prisma.follow.findFirst({
          where: { followerId: user.userId, followingId: targetId },
        })
      : await prisma.follow.findFirst({
          where: { followerId: user.userId, categoryId: targetId },
        });

    if (existing) {
      // 已关注 → 取消关注
      await prisma.follow.delete({ where: { id: existing.id } });
      return NextResponse.json({ following: false });
    }

    // 未关注 → 添加关注
    await prisma.follow.create({
      data: type === 'user'
        ? { followerId: user.userId, followingId: targetId }
        : { followerId: user.userId, categoryId: targetId },
    });

    return NextResponse.json({ following: true });
  } catch (error) {
    console.error('[FOLLOW TOGGLE ERROR]', error);
    return NextResponse.json(
      { error: '关注操作失败' },
      { status: 500 }
    );
  }
}
