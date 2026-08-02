import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

/**
 * POST /api/admin/test-email
 * 发送测试邮件
 *
 * Cloudflare Workers 不支持 TCP 连接，因此 nodemailer (SMTP) 不可用。
 * 改用 Resend API（基于 HTTP fetch）发送邮件。
 *
 * 配置方式：
 *   1. 在 resend.com 注册并获取 API Key
 *   2. 在 Cloudflare Workers 环境变量中设置 RESEND_API_KEY
 *   3. （可选）设置 RESEND_FROM_EMAIL 指定发件地址，如 noreply@yourdomain.com
 *      注意：发件域名需在 Resend 后台验证
 */
export async function POST(request: NextRequest) {
  try {
    // admin鉴权
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

    // 检查 Resend API Key 是否配置
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        {
          error:
            '邮件发送未配置。Cloudflare Workers 不支持 SMTP（TCP），请使用 Resend API：\n' +
            '1. 在 resend.com 注册并获取 API Key\n' +
            '2. 在 Cloudflare Workers 环境变量中设置 RESEND_API_KEY\n' +
            '3. （可选）设置 RESEND_FROM_EMAIL 指定发件地址',
        },
        { status: 400 }
      );
    }

    // 从数据库读取发件人名称配置（可选）
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: ['smtp_from_name'] },
      },
    });
    const config: Record<string, string> = {};
    for (const s of settings) config[s.key] = s.value;

    const fromName = config.smtp_from_name || 'Gitd';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    // 使用 Resend API 发送邮件
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: '[Gitd] 邮件配置测试',
        html: `
          <div style="max-width:600px;margin:0 auto;padding:20px;font-family:sans-serif;">
            <h2 style="color:#3B82F6;">📧 邮件配置测试成功</h2>
            <p>这是一封来自 Gitd 的测试邮件。</p>
            <p>如果你收到了这封邮件，说明你的 Resend API 邮件配置是正确的。</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <p style="color:#999;font-size:12px;">
              发送时间: ${new Date().toLocaleString('zh-CN')}<br>
              邮件服务: Resend API<br>
              发件邮箱: ${fromEmail}
            </p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      return NextResponse.json(
        { error: `Resend API 调用失败（HTTP ${resendRes.status}）: ${errBody}` },
        { status: 502 }
      );
    }

    const data = await resendRes.json();

    return NextResponse.json({
      message: '测试邮件发送成功',
      id: data.id,
    });
  } catch (error: any) {
    console.error('[TEST EMAIL ERROR]', error);
    return NextResponse.json(
      { error: `邮件发送失败: ${error.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
