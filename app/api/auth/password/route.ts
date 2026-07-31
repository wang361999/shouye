import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, comparePassword, hashPassword } from '@/lib/auth';

/** POST /api/auth/password - 修改密码 */
export async function POST(request: NextRequest) {
  try {
    // ---- 登录认证 ----
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    // ---- 解析请求体 ----
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // ---- 输入校验 ----
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: '当前密码和新密码不能为空' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: '新密码长度不能少于6位' },
        { status: 400 }
      );
    }

    // ---- 查找用户并验证旧密码 ----
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    const isPasswordValid = await comparePassword(currentPassword, dbUser.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '当前密码不正确' },
        { status: 400 }
      );
    }

    // ---- 加密新密码并更新数据库 ----
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.userId },
      data: { password: hashedPassword },
    });

    return NextResponse.json({
      message: '密码修改成功',
    });
  } catch (error) {
    console.error('[CHANGE PASSWORD ERROR]', error);
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    );
  }
}
