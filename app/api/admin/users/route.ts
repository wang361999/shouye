import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth, hashPassword } from '@/lib/auth';
import { logOperation } from '@/lib/admin-log';

// ============ GET /api/admin/users - 获取用户列表 / 操作日志 ============
export async function GET(request: NextRequest) {
  try {
    // admin鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // === 操作日志分支 ===
    if (type === 'logs') {
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '20', 10);
      const action = searchParams.get('action');
      const username = searchParams.get('username');
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (action && action !== 'all') {
        where.action = action;
      }
      if (username) {
        where.username = { contains: username };
      }

      const [logs, total] = await Promise.all([
        prisma.operationLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.operationLog.count({ where }),
      ]);

      return NextResponse.json({
        data: logs,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    }

    // === 用户列表 ===
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || undefined;
    const role = searchParams.get('role') || undefined;
    const status = searchParams.get('status') || undefined;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    // 查询总数和分页数据
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          avatar: true,
          status: true,
          mutedUntil: true,
          postCount: true,
          commentCount: true,
          lastActiveAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: users,
      total,
      page,
      totalPages,
    });
  } catch (error) {
    console.error('[ADMIN USERS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取用户列表失败' },
      { status: 500 }
    );
  }
}

// ============ POST /api/admin/users - 管理员操作用户 ============
export async function POST(request: NextRequest) {
  try {
    // admin鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: '缺少操作类型' },
        { status: 400 }
      );
    }

    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: '缺少用户 ID' },
        { status: 400 }
      );
    }

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // ---- 根据操作类型处理 ----

    if (action === 'mute') {
      // 禁言用户
      const { hours } = body;
      if (!hours || hours <= 0) {
        return NextResponse.json(
          { error: '禁言时长必须大于0' },
          { status: 400 }
        );
      }

      const mutedUntil = new Date();
      mutedUntil.setHours(mutedUntil.getHours() + hours);

      await prisma.user.update({
        where: { id: userId },
        data: { status: 'muted', mutedUntil },
      });

      await logOperation(
        admin.userId,
        admin.username,
        'mute_user',
        `User:${userId}`,
        `禁言用户 ${targetUser.username} ${hours}小时`
      );

      return NextResponse.json({ message: `已禁言用户 ${targetUser.username} ${hours}小时` });
    }

    if (action === 'unmute') {
      // 解除禁言
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'active', mutedUntil: null },
      });

      await logOperation(
        admin.userId,
        admin.username,
        'unmute_user',
        `User:${userId}`,
        `解除禁言 ${targetUser.username}`
      );

      return NextResponse.json({ message: `已解除 ${targetUser.username} 的禁言` });
    }

    if (action === 'ban') {
      // 封禁用户
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'banned' },
      });

      await logOperation(
        admin.userId,
        admin.username,
        'ban_user',
        `User:${userId}`,
        `封禁用户 ${targetUser.username}`
      );

      return NextResponse.json({ message: `已封禁用户 ${targetUser.username}` });
    }

    if (action === 'unban') {
      // 解封
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'active' },
      });

      await logOperation(
        admin.userId,
        admin.username,
        'unban_user',
        `User:${userId}`,
        `解封用户 ${targetUser.username}`
      );

      return NextResponse.json({ message: `已解封用户 ${targetUser.username}` });
    }

    if (action === 'role') {
      // 修改角色
      const { role } = body;
      if (!role || !['ADMIN', 'USER'].includes(role)) {
        return NextResponse.json(
          { error: '无效的角色值，必须是 ADMIN 或 USER' },
          { status: 400 }
        );
      }

      // 不能修改自己的角色
      if (userId === admin.userId) {
        return NextResponse.json(
          { error: '不能修改自己的角色' },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: { role: role as 'ADMIN' | 'USER' },
      });

      await logOperation(
        admin.userId,
        admin.username,
        'change_role',
        `User:${userId}`,
        `修改 ${targetUser.username} 角色为 ${role}`
      );

      return NextResponse.json({ message: `已将 ${targetUser.username} 的角色修改为 ${role}` });
    }

    if (action === 'resetPassword') {
      // 重置密码
      const { newPassword } = body;
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { error: '新密码长度不能少于6位' },
          { status: 400 }
        );
      }

      const hashedPassword = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      await logOperation(
        admin.userId,
        admin.username,
        'reset_password',
        `User:${userId}`,
        `重置 ${targetUser.username} 的密码`
      );

      return NextResponse.json({ message: `已重置 ${targetUser.username} 的密码` });
    }

    if (action === 'delete') {
      // 删除用户（硬删除）
      // 不能删除自己
      if (userId === admin.userId) {
        return NextResponse.json(
          { error: '不能删除自己的账号' },
          { status: 400 }
        );
      }

      // 删除用户关联的数据
      await prisma.$transaction([
        // 删除用户的点赞
        prisma.like.deleteMany({ where: { userId } }),
        // 删除用户的评论（软删除）
        prisma.comment.updateMany({
          where: { authorId: userId, deletedAt: null },
          data: { deletedAt: new Date() },
        }),
        // 将用户的帖子设为已删除
        prisma.post.updateMany({
          where: { authorId: userId },
          data: { status: 'DELETED' },
        }),
        // 删除用户
        prisma.user.delete({ where: { id: userId } }),
      ]);

      await logOperation(
        admin.userId,
        admin.username,
        'delete_user',
        `User:${userId}`,
        `删除用户 ${targetUser.username}（${targetUser.email}）`
      );

      return NextResponse.json({ message: `已删除用户 ${targetUser.username}` });
    }

    return NextResponse.json(
      {
        error: '不支持的操作。支持的操作: mute, unmute, ban, unban, role, resetPassword, delete',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[ADMIN USERS ACTION ERROR]', error);
    return NextResponse.json(
      { error: '用户操作失败' },
      { status: 500 }
    );
  }
}
