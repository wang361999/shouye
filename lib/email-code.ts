import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export type EmailCodePurpose = 'register' | 'reset_password';

const CODE_TTL_MINUTES = 10;
const RESEND_INTERVAL_MS = 60_000;
const MAX_VERIFY_ATTEMPTS = 5;

export function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

function hashCode(email: string, purpose: EmailCodePurpose, code: string): string {
  return crypto
    .createHash('sha256')
    .update(`${email.toLowerCase()}:${purpose}:${code}:${process.env.JWT_SECRET || 'gitd-email-code'}`)
    .digest('hex');
}

function generateCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function getSystemSettings(keys: string[]) {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: keys } },
  });
  const result: Record<string, string> = {};
  for (const item of settings) result[item.key] = item.value;
  return result;
}

export async function isEmailVerifyEnabled(): Promise<boolean> {
  const settings = await getSystemSettings(['email_verify']);
  return settings.email_verify === 'true';
}

export async function sendEmailCode(email: string, purpose: EmailCodePurpose) {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  const latest = await prisma.emailVerificationCode.findFirst({
    where: {
      email: normalizedEmail,
      purpose,
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_INTERVAL_MS) {
    return {
      success: false,
      status: 429,
      error: '验证码发送过于频繁，请 1 分钟后再试',
    };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

  await prisma.emailVerificationCode.create({
    data: {
      email: normalizedEmail,
      purpose,
      codeHash: hashCode(normalizedEmail, purpose, code),
      expiresAt,
    },
  });

  const smtpConfig = await getSystemSettings([
    'smtp_host',
    'smtp_port',
    'smtp_user',
    'smtp_pass',
    'smtp_from_name',
    'smtp_secure',
  ]);
  const fromName = smtpConfig.smtp_from_name || 'Gitd';
  const subject = purpose === 'register' ? '[Gitd] 注册邮箱验证码' : '[Gitd] 找回密码验证码';
  const actionText = purpose === 'register' ? '注册账号' : '重置密码';

  const result = await sendEmail(
    {
      to: normalizedEmail,
      subject,
      html: `
        <div style="max-width:600px;margin:0 auto;padding:24px;font-family:Arial,'Microsoft YaHei',sans-serif;color:#111827;">
          <h2 style="margin:0 0 16px;color:#2563eb;">${subject}</h2>
          <p style="font-size:14px;line-height:1.8;">你正在${actionText}，验证码为：</p>
          <div style="margin:20px 0;padding:18px 24px;background:#eff6ff;border-radius:12px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#1d4ed8;">
            ${code}
          </div>
          <p style="font-size:13px;color:#6b7280;">验证码 ${CODE_TTL_MINUTES} 分钟内有效，请勿转发给他人。</p>
        </div>
      `,
      text: `你正在${actionText}，验证码为：${code}。验证码 ${CODE_TTL_MINUTES} 分钟内有效。`,
    },
    smtpConfig,
    fromName,
  );

  if (!result.success) {
    return { success: false, status: 400, error: result.message };
  }

  return { success: true };
}

export async function verifyEmailCode(
  email: string,
  purpose: EmailCodePurpose,
  code: string,
  markUsed = false,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim();

  if (!/^\d{6}$/.test(normalizedCode)) {
    return { success: false, error: '请输入 6 位邮箱验证码' };
  }

  const record = await prisma.emailVerificationCode.findFirst({
    where: {
      email: normalizedEmail,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    return { success: false, error: '验证码不存在或已过期，请重新获取' };
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { success: false, error: '验证码错误次数过多，请重新获取' };
  }

  const matched = record.codeHash === hashCode(normalizedEmail, purpose, normalizedCode);
  if (!matched) {
    await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { success: false, error: '邮箱验证码不正确' };
  }

  if (markUsed) {
    await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
  }

  return { success: true };
}
