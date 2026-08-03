/**
 * 统一邮件发送模块
 *
 * 使用 Resend API 发送邮件：
 *   1. 优先读取数据库 SystemSetting 中的 resend_api_key / resend_from_email
 *   2. 数据库未配置时，回退读取环境变量 RESEND_API_KEY / RESEND_FROM_EMAIL
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
  provider?: 'resend';
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
 * 发送邮件（统一入口）
 *
 * @param params 邮件内容
 * @param mailConfig 邮件配置（从数据库读取，可选）
 * @param fromName 发件人名称
 */
export async function sendEmail(
  params: SendEmailParams,
  mailConfig?: Record<string, string>,
  fromName: string = 'Gitd',
): Promise<SendEmailResult> {
  try {
    if (mailConfig?.resend_api_key || process.env.RESEND_API_KEY) {
      return await sendViaResend(params, fromName, mailConfig);
    }

    return {
      success: false,
      message:
        '邮件发送未配置。请在后台系统设置中配置 Resend API Key 和发件邮箱。',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `邮件发送失败: ${error.message || '未知错误'}`,
    };
  }
}
