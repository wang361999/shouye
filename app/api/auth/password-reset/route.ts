import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getClientIP, rateLimit } from '@/lib/rate-limit';
import { isValidEmail, verifyEmailCode } from '@/lib/email-code';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** POST /api/auth/password-reset - 通过邮箱验证码重置密码 */
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const rl = rateLimit(`password-reset:${clientIP}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: '重置请求过于频繁，请稍后再试' },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.emailCode || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: '请输入正确的邮箱地址' },
        { status: 400 },
      );
    }

    if (newPassword.length < 6 || newPassword.length > 32) {
      return NextResponse.json(
        { error: '新密码长度需为 6-32 个字符' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: '验证码不存在或已过期，请重新获取' },
        { status: 400 },
      );
    }

    const verifyResult = await verifyEmailCode(email, 'reset_password', code, true);
    if (!verifyResult.success) {
      return NextResponse.json(
        { error: verifyResult.error || '邮箱验证码校验失败' },
        { status: 400 },
      );
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: '密码已重置，请使用新密码登录' });
  } catch (error) {
    console.error('[PASSWORD RESET ERROR]', error);
    return NextResponse.json(
      { error: '密码重置失败，请稍后重试' },
      { status: 500 },
    );
  }
}
