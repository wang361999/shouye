import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

/**
 * POST /api/admin/test-email
 * 使用已保存的 SMTP 配置发送一封测试邮件
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

    // 从数据库读取 SMTP 配置
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_name', 'smtp_secure'],
        },
      },
    });

    const config: Record<string, string> = {};
    for (const s of settings) {
      config[s.key] = s.value;
    }

    if (!config.smtp_host || !config.smtp_user) {
      return NextResponse.json(
        { error: 'SMTP 配置不完整，请先填写并保存 SMTP 服务器地址和用户名' },
        { status: 400 }
      );
    }

    // 动态导入 nodemailer（避免构建时问题）
    const nodemailer = await import('nodemailer');

    const port = parseInt(config.smtp_port || '587', 10);
    const secure = config.smtp_secure === 'true' || port === 465;

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port,
      secure,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass,
      },
    });

    const fromName = config.smtp_from_name || 'Gitd';
    const fromEmail = config.smtp_user;

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: '[Gitd] 邮件配置测试',
      html: `
        <div style="max-width:600px;margin:0 auto;padding:20px;font-family:sans-serif;">
          <h2 style="color:#3B82F6;">📧 邮件配置测试成功</h2>
          <p>这是一封来自 Gitd 的测试邮件。</p>
          <p>如果你收到了这封邮件，说明你的 SMTP 邮箱配置是正确的。</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="color:#999;font-size:12px;">
            发送时间: ${new Date().toLocaleString('zh-CN')}<br>
            SMTP 服务器: ${config.smtp_host}<br>
            发件邮箱: ${config.smtp_user}
          </p>
        </div>
      `,
    });

    return NextResponse.json({ message: '测试邮件发送成功' });
  } catch (error: any) {
    console.error('[TEST EMAIL ERROR]', error);
    return NextResponse.json(
      { error: `邮件发送失败: ${error.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
