import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

/**
 * POST /api/admin/test-email
 * 发送测试邮件（双平台兼容）
 *
 * 自动检测配置选择发送方式：
 *   - 数据库或环境变量配置了 Resend → 用 Resend API（Vercel + Cloudflare 均可用）
 *   - 配置了 SMTP → 用 nodemailer（仅 Vercel / Node.js 可用）
 */
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { to } = body;

    if (!to) {
      return NextResponse.json(
        { error: '请提供收件邮箱地址' },
        { status: 400 }
      );
    }

    // 从数据库读取邮件配置和发件人名称
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'resend_api_key',
            'resend_from_email',
            'smtp_host',
            'smtp_port',
            'smtp_user',
            'smtp_pass',
            'smtp_from_name',
            'smtp_secure',
          ],
        },
      },
    });
    const mailConfig: Record<string, string> = {};
    for (const s of settings) mailConfig[s.key] = s.value;

    const fromName = mailConfig.smtp_from_name || 'Gitd';

    // 发送测试邮件
    const result = await sendEmail(
      {
        to,
        subject: '[Gitd] 邮件配置测试',
        html: `
          <div style="max-width:600px;margin:0 auto;padding:20px;font-family:sans-serif;">
            <h2 style="color:#3B82F6;">📧 邮件配置测试成功</h2>
            <p>这是一封来自 Gitd 的测试邮件。</p>
            <p>如果你收到了这封邮件，说明你的邮件配置是正确的。</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <p style="color:#999;font-size:12px;">
              发送时间: ${new Date().toLocaleString('zh-CN')}<br>
            </p>
          </div>
        `,
      },
      mailConfig,
      fromName,
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: '测试邮件发送成功',
      provider: result.provider,
      messageId: result.messageId,
    });
  } catch (error: any) {
    console.error('[TEST EMAIL ERROR]', error);
    return NextResponse.json(
      { error: `邮件发送失败: ${error.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
