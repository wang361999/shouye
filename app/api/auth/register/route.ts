import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { sanitizeString } from '@/lib/security';
import { isEmailVerifyEnabled, verifyEmailCode } from '@/lib/email-code';

/** 邮箱格式校验 */
function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

/** POST /api/auth/register - 用户注册 */
export async function POST(request: NextRequest) {
  // ---- 限流：每 IP 每分钟最多 5 次注册请求 ----
  const clientIP = getClientIP(request);
  const rl = rateLimit(`register:${clientIP}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: '注册请求过于频繁，请稍后再试' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    let { username, email, password, emailCode } = body;

    // ---- 基础非空校验 ----
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: '用户名、邮箱和密码不能为空' },
        { status: 400 }
      );
    }

    // ---- 输入净化 ----
    username = sanitizeString(String(username)).trim().slice(0, 20);
    email = String(email).trim().toLowerCase().slice(0, 100);
    password = String(password).slice(0, 128);

    // ---- 输入校验：用户名 3-20 字符 ----
    if (
      typeof username !== 'string' ||
      username.trim().length < 3 ||
      username.trim().length > 20
    ) {
      return NextResponse.json(
        { error: '用户名长度需为 3-20 个字符' },
        { status: 400 }
      );
    }

    // ---- 输入校验：邮箱格式 ----
    if (typeof email !== 'string' || !isValidEmail(email.trim())) {
      return NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    // ---- 输入校验：密码 6-32 字符 ----
    if (
      typeof password !== 'string' ||
      password.length < 6 ||
      password.length > 32
    ) {
      return NextResponse.json(
        { error: '密码长度需为 6-32 个字符' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // ---- 检查用户名是否已存在 ----
    const existingByUsername = await prisma.user.findUnique({
      where: { username: trimmedUsername },
    });
    if (existingByUsername) {
      return NextResponse.json(
        { error: '该用户名已被注册，请更换' },
        { status: 409 }
      );
    }

    // ---- 检查邮箱是否已存在 ----
    const existingByEmail = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });
    if (existingByEmail) {
      return NextResponse.json(
        { error: '该邮箱已被注册，请更换' },
        { status: 409 }
      );
    }

    // ---- 后台开启邮件验证时，注册必须提供邮箱验证码 ----
    const emailVerifyEnabled = await isEmailVerifyEnabled();
    if (emailVerifyEnabled) {
      if (!emailCode) {
        return NextResponse.json(
          { error: '请输入邮箱验证码' },
          { status: 400 }
        );
      }
      const verifyResult = await verifyEmailCode(
        trimmedEmail,
        'register',
        String(emailCode),
        true,
      );
      if (!verifyResult.success) {
        return NextResponse.json(
          { error: verifyResult.error || '邮箱验证码校验失败' },
          { status: 400 }
        );
      }
    }

    // ---- 使用 bcryptjs 哈希密码 ----
    const hashedPassword = await bcrypt.hash(password, 10);

    // ---- 创建用户（默认角色 USER） ----
    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        email: trimmedEmail,
        password: hashedPassword,
        role: 'USER',
      },
    });

    // ---- 生成 JWT token ----
    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    // ---- 唯一约束冲突的友好提示 ----
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('username')) {
          return NextResponse.json(
            { error: '该用户名已被注册，请更换' },
            { status: 409 }
          );
        }
        if (target.includes('email')) {
          return NextResponse.json(
            { error: '该邮箱已被注册，请更换' },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { error: '该用户名或邮箱已被注册' },
          { status: 409 }
        );
      }
    }
    console.error('[REGISTER ERROR]', error);
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    );
  }
}
