import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { getUserLevel } from '@/lib/user-level';

// ============ GET /api/user/profile - 获取当前登录用户资料 ============
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

    // ---- 查询用户信息（排除 password） ----
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatar: true,
        bio: true,
        postCount: true,
        commentCount: true,
        createdAt: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 },
      );
    }

    // ---- 计算用户等级信息 ----
    const levelInfo = getUserLevel(dbUser.postCount, dbUser.commentCount);

    return NextResponse.json({
      ...dbUser,
      level: levelInfo,
    });
  } catch (error) {
    console.error('[USER PROFILE GET ERROR]', error);
    return NextResponse.json(
      { error: '获取用户资料失败' },
      { status: 500 },
    );
  }
}

// ============ PUT /api/user/profile - 更新用户资料 ============
// body: { username?, bio?, avatar? }
export async function PUT(request: NextRequest) {
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
    const { username, bio, avatar } = body;

    // ---- 构建更新数据 ----
    const updateData: Record<string, unknown> = {};

    // 用户名更新
    if (username !== undefined) {
      const trimmedUsername = String(username).trim();
      if (!trimmedUsername) {
        return NextResponse.json(
          { error: '用户名不能为空' },
          { status: 400 },
        );
      }
      if (trimmedUsername.length > 20) {
        return NextResponse.json(
          { error: '用户名不能超过 20 个字符' },
          { status: 400 },
        );
      }

      // 检查用户名唯一性（排除自己）
      if (trimmedUsername !== user.username) {
        const existing = await prisma.user.findUnique({
          where: { username: trimmedUsername },
        });
        if (existing) {
          return NextResponse.json(
            { error: '该用户名已被占用' },
            { status: 400 },
          );
        }
      }
      updateData.username = trimmedUsername;
    }

    // 个人简介更新
    if (bio !== undefined) {
      const trimmedBio = String(bio ?? '').trim();
      if (trimmedBio.length > 200) {
        return NextResponse.json(
          { error: '个人简介不能超过 200 个字符' },
          { status: 400 },
        );
      }
      updateData.bio = trimmedBio || null;
    }

    // 头像更新
    if (avatar !== undefined) {
      const trimmedAvatar = String(avatar ?? '').trim();
      updateData.avatar = trimmedAvatar || null;
    }

    // 没有任何字段需要更新
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '没有需要更新的字段' },
        { status: 400 },
      );
    }

    // ---- 执行更新 ----
    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatar: true,
        bio: true,
        postCount: true,
        commentCount: true,
        createdAt: true,
      },
    });

    // ---- 计算用户等级信息 ----
    const levelInfo = getUserLevel(
      updatedUser.postCount,
      updatedUser.commentCount,
    );

    return NextResponse.json({
      ...updatedUser,
      level: levelInfo,
      message: '资料更新成功',
    });
  } catch (error) {
    console.error('[USER PROFILE PUT ERROR]', error);
    return NextResponse.json(
      { error: '更新用户资料失败' },
      { status: 500 },
    );
  }
}
