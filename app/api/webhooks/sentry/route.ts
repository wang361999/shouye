import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getGithubToken } from '@/lib/collab';
import { rateLimitAsync, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';

/**
 * Sentry Webhook 接收端点
 *
 * 当 Sentry 检测到错误并触发告警时，通过 Webhook 通知本端点。
 * 本端点解析错误信息，自动创建 GitHub Issue，触发 AI 自动迭代修复。
 *
 * 安全策略：
 *   1. 通过 SENTRY_WEBHOOK_SECRET 环境变量验证请求（Sentry 告警规则中配置）
 *   2. 限流：每个 IP 每分钟最多 10 次
 *   3. 去重：同一错误（fingerprint）1 小时内只创建一次 Issue
 *
 * Sentry 告警规则配置：
 *   - URL: https://your-domain.com/api/webhooks/sentry
 *   - Method: POST
 *   - 认证：Header "X-Webhook-Secret: <SENTRY_WEBHOOK_SECRET 的值>"
 */

const REPO = process.env.GITHUB_REPO || 'wang361999/shouye';

/** 自动迭代执行规则 */
const ITERATION_RULES = [
  '先分析影响范围，再修改代码。',
  '本项目是开源免费项目，免费订单、免费授权、普通用户权限和后台功能可以自动迭代。',
  '不能泄露或改写 GitHub Token、数据库密码、OAuth 密钥、Vercel Token 等密钥。',
  '不能删除生产数据，不能执行删除表、删除字段、批量清空或不可回滚的数据迁移。',
  '涉及真实支付、付费扣款、外部计费服务或产生费用的操作必须人工确认。',
  '修改后必须说明改了哪里、优化了什么、验证结果。',
  '需要管理员确认后再上线。',
];

interface SentryIssue {
  id: string;
  title: string;
  culprit?: string;
  permalink?: string;
  level?: string;
  status?: string;
  firstSeen?: string;
  lastSeen?: string;
  eventCount?: number;
  userCount?: number;
  shortLink?: string;
  project?: {
    name?: string;
    slug?: string;
  };
  metadata?: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
  // Sentry Webhook payload 中 issue 嵌套在 data 字段
}

interface SentryWebhookPayload {
  action?: string;
  data?: {
    issue?: SentryIssue;
  };
  // 直接平铺的情况
  issue?: SentryIssue;
}

/**
 * 从 Sentry Webhook payload 中提取错误信息
 */
function parseSentryEvent(body: SentryWebhookPayload): {
  title: string;
  level: string;
  url: string;
  count: number;
  users: number;
  culprit: string;
  eventType: string;
  errorValue: string;
  fingerprint: string;
} | null {
  // Sentry Issue Alert payload 格式：body.data.issue
  // 也兼容直接 body.issue 的格式
  const issue = body.data?.issue || body.issue;
  if (!issue) return null;

  const title = issue.title || '未知错误';
  const level = issue.level || 'error';
  const url = issue.permalink || issue.shortLink || '';
  const count = issue.eventCount || 1;
  const users = issue.userCount || 0;
  const culprit = issue.culprit || issue.metadata?.filename || issue.metadata?.function || '未知位置';
  const eventType = issue.metadata?.type || 'Error';
  const errorValue = issue.metadata?.value || '';
  const fingerprint = issue.id || title;

  return { title, level, url, count, users, culprit, eventType, errorValue, fingerprint };
}

/**
 * 构建 GitHub Issue 内容
 */
function buildIssueBody(info: ReturnType<typeof parseSentryEvent>): string {
  if (!info) return '';
  const lines: string[] = [
    '## Sentry 错误告警',
    '',
    `**错误类型**: ${info.eventType}`,
    `**错误信息**: ${info.errorValue}`,
    `**发生位置**: ${info.culprit}`,
    `**错误级别**: ${info.level}`,
    `**触发次数**: ${info.count}`,
    `**影响用户数**: ${info.users}`,
    info.url ? `**Sentry 链接**: ${info.url}` : '',
    '',
    '## 修复要求',
    '',
    '1. 分析错误根因，查看相关代码。',
    '2. 修复错误并确保 `npm run build` 通过。',
    '3. 不要引入新的依赖（除非必要）。',
    '4. 修改后说明改了什么、为什么这样改。',
    '',
    '## 执行规则',
    '',
    ...ITERATION_RULES.map((rule, i) => `${i + 1}. ${rule}`),
    '',
    '---',
    `*此 Issue 由 Sentry Webhook 自动创建，时间: ${new Date().toISOString()}*`,
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * 创建 GitHub Issue
 */
async function createGitHubIssue(title: string, body: string): Promise<{ number: number | null; url: string } | null> {
  const token = await getGithubToken();
  if (!token) return null;

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'shouye-sentry-webhook',
      },
      body: JSON.stringify({ title, body }),
    });

    if (!res.ok) return null;
    const issue = await res.json();
    return { number: issue?.number || null, url: issue?.html_url || '' };
  } catch {
    return null;
  }
}

/**
 * 尝试触发 AI 执行器（如果配置了）
 */
async function triggerAiExecutor(requirement: string, issueUrl?: string): Promise<{ ok: boolean; status: number } | null> {
  const webhookUrl = process.env.AI_ITERATION_WEBHOOK_URL;
  if (!webhookUrl) return null;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: REPO,
        requirement,
        issueUrl,
        source: 'sentry_webhook',
        guardrails: ITERATION_RULES,
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * 去重检查：同一 fingerprint 在时间窗口内是否已处理过
 */
async function shouldProcess(fingerprint: string): Promise<boolean> {
  const dedupKey = `sentry_dedup_${fingerprint}`;
  const existing = await prisma.systemSetting.findUnique({ where: { key: dedupKey } });

  if (existing) {
    const createdAt = new Date(existing.value).getTime();
    const oneHour = 60 * 60 * 1000;
    if (Date.now() - createdAt < oneHour) {
      return false; // 1 小时内已处理过，跳过
    }
  }

  // 标记为已处理
  await prisma.systemSetting.upsert({
    where: { key: dedupKey },
    update: { value: new Date().toISOString() },
    create: { key: dedupKey, value: new Date().toISOString() },
  });

  return true;
}

/**
 * 记录到操作日志
 */
async function logSentryEvent(
  title: string,
  issueUrl: string,
  issueNumber: number | null,
  executorResult: { ok: boolean; status: number } | null,
): Promise<void> {
  const detail = [
    `Sentry 错误: ${title.slice(0, 80)}`,
    issueUrl ? `GitHub Issue: ${issueUrl}` : 'GitHub Issue 创建失败（未配置 Token）',
    executorResult
      ? executorResult.ok
        ? 'AI 执行器已通知'
        : `AI 执行器调用失败 (HTTP ${executorResult.status})`
      : '未配置 AI 执行器',
  ].join(' | ');

  await prisma.operationLog.create({
    data: {
      userId: 'sentry-webhook',
      username: 'Sentry',
      action: 'sentry_error_auto_iterate',
      target: 'SentryWebhook',
      detail,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // ---- 1. 限流 ----
    const clientIP = getClientIP(request);
    const rl = await rateLimitAsync(`sentry-webhook:${clientIP}`, 10, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: '请求过于频繁' },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }

    // ---- 2. 认证：验证 Webhook Secret ----
    const webhookSecret = process.env.SENTRY_WEBHOOK_SECRET;
    const providedSecret = request.headers.get('x-webhook-secret');

    if (webhookSecret) {
      // 配置了 Secret 时必须验证
      if (providedSecret !== webhookSecret) {
        return NextResponse.json({ error: '认证失败' }, { status: 401 });
      }
    }
    // 未配置 Secret 时允许通过（方便初始测试，生产建议配置）

    // ---- 3. 解析 Sentry payload ----
    const body = await request.json();
    const info = parseSentryEvent(body);

    if (!info) {
      return NextResponse.json(
        { error: '无法解析 Sentry 告警数据' },
        { status: 400 },
      );
    }

    // ---- 4. 去重检查 ----
    const shouldRun = await shouldProcess(info.fingerprint);
    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        message: '该错误在 1 小时内已处理过，跳过',
        deduplicated: true,
        fingerprint: info.fingerprint,
      });
    }

    // ---- 5. 创建 GitHub Issue ----
    const issueTitle = `[Sentry 自动修复] ${info.title.slice(0, 60)}`;
    const issueBody = buildIssueBody(info);
    const issue = await createGitHubIssue(issueTitle, issueBody);

    // ---- 6. 触发 AI 执行器 ----
    const requirement = `Sentry 检测到错误：${info.title}。位置：${info.culprit}。请分析并修复。`;
    const executor = await triggerAiExecutor(requirement, issue?.url);

    // ---- 7. 记录操作日志 ----
    await logSentryEvent(info.title, issue?.url || '', issue?.number || null, executor);

    // ---- 8. 返回结果 ----
    return NextResponse.json({
      success: true,
      message: 'Sentry 错误已接收并触发自动迭代',
      error: {
        title: info.title,
        level: info.level,
        culprit: info.culprit,
        count: info.count,
      },
      githubIssue: issue
        ? { number: issue.number, url: issue.url }
        : null,
      aiExecutor: executor
        ? { triggered: true, ok: executor.ok }
        : { triggered: false, reason: 'AI_ITERATION_WEBHOOK_URL 未配置' },
    });
  } catch (error) {
    console.error('[SENTRY WEBHOOK ERROR]', error);
    return NextResponse.json(
      { error: '处理 Sentry 告警失败' },
      { status: 500 },
    );
  }
}

/**
 * GET - 健康检查
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'sentry-webhook',
    description: '接收 Sentry 错误告警并触发自动迭代',
    authRequired: !!process.env.SENTRY_WEBHOOK_SECRET,
  });
}
