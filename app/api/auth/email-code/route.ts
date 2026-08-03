import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getClientIP, rateLimit } from '@/lib/rate-limit';
import { isEmailVerifyEnabled, isValidEmail, sendEmailCode } from '@/lib/email-code';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** POST /api/auth/email-code - 发送注册或找回密码邮箱验证码 */
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const rl = rateLimit(`email-code:${clientIP}`, 8, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: '验证码请求过于频繁，请稍后再试' },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const purpose = body.purpose === 'reset_password' ? 'reset_password' : 'register';

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: '请输入正确的邮箱地址' },
        { status: 400 },
      );
    }

    if (purpose === 'register') {
      const enabled = await isEmailVerifyEnabled();
      if (!enabled) {
        return NextResponse.json(
          { error: '当前未开启注册邮箱验证' },
          { status: 400 },
        );
      }
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return NextResponse.json(
          { error: '该邮箱已被注册，请更换' },
          { status: 409 },
        );
      }
    }

    if (purpose === 'reset_password') {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (!existingUser) {
        // 不泄露邮箱是否注册，前端仍提示用户查收。
        return NextResponse.json({ message: '如果邮箱存在，验证码将发送到该邮箱' });
      }
    }

    const result = await sendEmailCode(email, purpose);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '验证码发送失败' },
        { status: result.status || 400 },
      );
    }

    return NextResponse.json({ message: '验证码已发送，请查收邮箱' });
  } catch (error) {
    console.error('[SEND EMAIL CODE ERROR]', error);
    return NextResponse.json(
      { error: '验证码发送失败，请稍后重试' },
      { status: 500 },
    );
  }
}
