import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { comparePassword, generateToken } from '@/lib/auth';

/** POST /api/auth - 用户登录 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // ---- 输入校验 ----
    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    // ---- 查找用户 ----
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // ---- 验证密码 ----
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // ---- 生成 JWT ----
    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    // ---- 返回用户信息（不返回密码） ----
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('[AUTH LOGIN ERROR]', error);
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    );
  }
}
