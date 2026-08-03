/**
 * 统一邮件发送模块 - 双平台兼容
 *
 * 检测运行平台和配置，自动选择发送方式：
 *   - Vercel / Node.js 环境：使用 nodemailer (SMTP)，从数据库读取 SMTP 配置
 *   - Cloudflare Workers：使用 Resend API (HTTP fetch)，从环境变量读取配置
 *
 * 优先级判断：
 *   1. 如果配置了 Resend（数据库或环境变量） → 用 Resend（两个平台都可用）
 *   2. 如果配置了 SMTP（数据库中） → 用 nodemailer（仅 Vercel/Node 可用）
 *   3. 都没配置 → 返回未配置错误
 */

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  provider?: 'resend' | 'smtp';
  messageId?: string;
}

/**
 * 使用 Resend API 发送邮件（基于 HTTP，Cloudflare 和 Vercel 均可用）
 */
async function sendViaResend(
  params: SendEmailParams,
  fromName: string,
  mailConfig?: Record<string, string>,
): Promise<SendEmailResult> {
  const apiKey = mailConfig?.resend_api_key || process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, message: 'Resend API Key 未配置' };
  }

  const fromEmail = mailConfig?.resend_from_email || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const toArr = Array.isArray(params.to) ? params.to : [params.to];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: toArr,
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    return {
      success: false,
      message: `Resend API 失败（HTTP ${res.status}）: ${errBody}`,
    };
  }

  const data = await res.json();
  return {
    success: true,
    message: '发送成功',
    provider: 'resend',
    messageId: data.id,
  };
}

/**
 * 使用 nodemailer SMTP 发送邮件（仅 Vercel / Node.js 环境）
 *
 * nodemailer 依赖 TCP 连接，Cloudflare Workers 不支持。
 * 使用动态导入，在 Cloudflare 上不会因加载失败而崩溃。
 */
async function sendViaSmtp(
  params: SendEmailParams,
  smtpConfig: Record<string, string>,
  fromName: string,
): Promise<SendEmailResult> {
  if (!smtpConfig.smtp_host || !smtpConfig.smtp_user) {
    return { success: false, message: 'SMTP 配置不完整' };
  }

  // 动态导入 nodemailer（Cloudflare 上会失败，但不会走到这里）
  // 使用 Function 构造器避免打包器静态解析，从而不将 nodemailer 打包进 Cloudflare Worker
  let nodemailer: any;
  try {
    const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;
    nodemailer = await dynamicImport('nodemailer');
  } catch {
    return {
      success: false,
      message: 'nodemailer 不可用（当前环境可能不支持 TCP 连接）',
    };
  }

  const port = parseInt(smtpConfig.smtp_port || '587', 10);
  const secure = smtpConfig.smtp_secure === 'true' || port === 465;

  const transporter = nodemailer.createTransport({
    host: smtpConfig.smtp_host,
    port,
    secure,
    auth: {
      user: smtpConfig.smtp_user,
      pass: smtpConfig.smtp_pass,
    },
  });

  const fromEmail = smtpConfig.smtp_user;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
    subject: params.subject,
    html: params.html,
    ...(params.text ? { text: params.text } : {}),
  });

  return {
    success: true,
    message: '发送成功',
    provider: 'smtp',
    messageId: info.messageId,
  };
}

/**
 * 发送邮件（统一入口）
 *
 * @param params 邮件内容
 * @param mailConfig 邮件配置（从数据库读取，可选，包含 Resend 和 SMTP）
 * @param fromName 发件人名称
 */
export async function sendEmail(
  params: SendEmailParams,
  mailConfig?: Record<string, string>,
  fromName: string = 'Gitd',
): Promise<SendEmailResult> {
  try {
    // 1. 优先使用 Resend API（两个平台都可用）
    if (mailConfig?.resend_api_key || process.env.RESEND_API_KEY) {
      return await sendViaResend(params, fromName, mailConfig);
    }

    // 2. 回退到 SMTP（仅 Vercel / Node.js 环境可用）
    if (mailConfig && mailConfig.smtp_host && mailConfig.smtp_user) {
      return await sendViaSmtp(params, mailConfig, fromName);
    }

    // 3. 都没配置
    return {
      success: false,
      message:
        '邮件发送未配置。请选择一种方式：\n' +
        '方式一（推荐，双平台通用）：在后台系统设置中配置 Resend API Key 和发件邮箱\n' +
        '方式二（仅 Vercel）：在后台系统设置中配置 SMTP 服务器信息',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `邮件发送失败: ${error.message || '未知错误'}`,
    };
  }
}
