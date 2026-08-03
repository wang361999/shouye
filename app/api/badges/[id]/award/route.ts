import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

// ============ POST /api/badges/[id]/award - 手动给用户颁发徽章（管理员专用） ============
// body: { userId }
// 创建 UserBadge 记录，每个用户每个徽章只能获得一次（依靠唯一约束）
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // 管理员鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { id: badgeId } = params;

    if (!badgeId) {
      return NextResponse.json(
        { error: '无效的徽章 ID' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: '必须提供 userId' },
        { status: 400 },
      );
    }

    // ---- 校验徽章是否存在 ----
    const badge = await prisma.badge.findUnique({
      where: { id: badgeId },
    });

    if (!badge) {
      return NextResponse.json(
        { error: '徽章不存在' },
        { status: 404 },
      );
    }

    // ---- 校验用户是否存在 ----
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 },
      );
    }

    // ---- 检查是否已颁发过（避免唯一约束冲突）----
    const existing = await prisma.userBadge.findUnique({
      where: {
        userId_badgeId: { userId, badgeId },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: '该用户已获得此徽章',
          userBadge: existing,
        },
        { status: 409 },
      );
    }

    // ---- 创建 UserBadge 记录 ----
    const userBadge = await prisma.userBadge.create({
      data: {
        userId,
        badgeId,
      },
      include: {
        badge: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json(userBadge, { status: 201 });
  } catch (error) {
    console.error('[BADGE AWARD ERROR]', error);
    return NextResponse.json(
      { error: '颁发徽章失败' },
      { status: 500 },
    );
  }
}
