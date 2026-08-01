import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { comparePassword, generateToken } from '@/lib/auth';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { sanitizeString } from '@/lib/security';

/** POST /api/auth - 用户登录 */
export async function POST(request: NextRequest) {
  // ---- 限流：每 IP 每分钟最多 10 次登录尝试 ----
  const clientIP = getClientIP(request);
  const rlKey = `login:${clientIP}`;
  const rl = rateLimit(rlKey, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: '登录尝试过于频繁，请稍后再试' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  try {
    const body = await request.json();
    let { username, password } = body;

    // ---- 输入校验 ----
    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    // ---- 输入净化 ----
    username = sanitizeString(String(username)).slice(0, 50);
    // 不净化密码（可能包含特殊字符），但限制长度
    password = String(password).slice(0, 128);

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

    // ---- 检查用户状态 ----
    if (user.status === 'banned') {
      return NextResponse.json(
        { error: '账号已被封禁，请联系管理员' },
        { status: 403 }
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
