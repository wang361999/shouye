import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SETTING_KEYS = {
  enabled: 'auto_iteration_enabled',
  requireApproval: 'auto_iteration_require_approval',
  safeMode: 'auto_iteration_safe_mode',
  lastRequest: 'auto_iteration_last_request',
  lastDeployApproval: 'auto_iteration_last_deploy_approval',
};

const REPO = 'wang361999/shouye';

const DEFAULT_CONFIG = {
  enabled: false,
  requireApproval: true,
  safeMode: true,
};

function toBool(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value === 'true';
}

function safeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

async function readConfig() {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
  });
  const map = Object.fromEntries(rows.map((item) => [item.key, item.value]));

  return {
    enabled: toBool(map[SETTING_KEYS.enabled], DEFAULT_CONFIG.enabled),
    requireApproval: toBool(map[SETTING_KEYS.requireApproval], DEFAULT_CONFIG.requireApproval),
    safeMode: toBool(map[SETTING_KEYS.safeMode], DEFAULT_CONFIG.safeMode),
    lastRequest: map[SETTING_KEYS.lastRequest] || '',
    lastDeployApproval: map[SETTING_KEYS.lastDeployApproval] || '',
    manualDeployConfigured: Boolean(process.env.VERCEL_DEPLOY_HOOK_URL),
    aiExecutorConfigured: Boolean(process.env.AI_ITERATION_WEBHOOK_URL),
    githubIssueConfigured: Boolean(process.env.GITHUB_TOKEN),
  };
}

async function createGitHubIssue(requirement: string) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  const issueRes = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'shouye-auto-iteration',
    },
    body: JSON.stringify({
      title: `AI 自动迭代请求：${requirement.slice(0, 60)}`,
      body: [
        '## 迭代需求',
        requirement,
        '',
        '## 执行规则',
        '1. 先分析影响范围，再修改代码。',
        '2. 默认不改支付、授权、权限、数据库结构和生产数据。',
        '3. 修改后必须说明改了哪里、优化了什么、验证结果。',
        '4. 需要管理员确认后再上线。',
      ].join('\n'),
      labels: ['ai-auto-iteration'],
    }),
  });

  if (!issueRes.ok) return null;
  const issue = await issueRes.json();
  return {
    number: issue?.number || null,
    url: issue?.html_url || '',
  };
}

async function triggerAiExecutor(requirement: string, issueUrl?: string) {
  const webhookUrl = process.env.AI_ITERATION_WEBHOOK_URL;
  if (!webhookUrl) return null;

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo: REPO,
      requirement,
      issueUrl,
      guardrails: [
        '先生成变更日志，再由管理员确认是否上线',
        '默认不改支付、授权、权限、数据库结构和生产数据',
        '必须通过 lint/build 后才能推送',
      ],
    }),
  });

  return {
    ok: res.ok,
    status: res.status,
  };
}

async function saveSetting(key: string, value: string) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function logOperation(
  userId: string,
  username: string,
  action: string,
  detail: string,
) {
  await prisma.operationLog.create({
    data: {
      userId,
      username,
      action,
      target: 'AutoIteration',
      detail,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    return NextResponse.json(await readConfig());
  } catch (error) {
    console.error('[AUTO ITERATION GET ERROR]', error);
    return NextResponse.json({ error: '获取自动迭代配置失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const action = safeString(body.action);

    if (action === 'update_config') {
      const enabled = Boolean(body.enabled);
      const requireApproval = body.requireApproval !== false;
      const safeMode = body.safeMode !== false;

      await prisma.$transaction([
        prisma.systemSetting.upsert({
          where: { key: SETTING_KEYS.enabled },
          update: { value: String(enabled) },
          create: { key: SETTING_KEYS.enabled, value: String(enabled) },
        }),
        prisma.systemSetting.upsert({
          where: { key: SETTING_KEYS.requireApproval },
          update: { value: String(requireApproval) },
          create: { key: SETTING_KEYS.requireApproval, value: String(requireApproval) },
        }),
        prisma.systemSetting.upsert({
          where: { key: SETTING_KEYS.safeMode },
          update: { value: String(safeMode) },
          create: { key: SETTING_KEYS.safeMode, value: String(safeMode) },
        }),
      ]);

      await logOperation(
        admin.userId,
        admin.username,
        'auto_iteration_config',
        `更新自动迭代配置：开关=${enabled ? '开启' : '关闭'}，上线确认=${requireApproval ? '需要' : '不需要'}，安全模式=${safeMode ? '开启' : '关闭'}`,
      );

      return NextResponse.json({
        message: '自动迭代配置已保存',
        config: await readConfig(),
      });
    }

    if (action === 'trigger_inspection') {
      const config = await readConfig();
      if (!config.enabled) {
        return NextResponse.json(
          { error: '自动迭代开关未开启，请先开启后再触发' },
          { status: 400 },
        );
      }

      const requirement = safeString(body.requirement, '后台手动触发免费自动巡检');
      const createdAt = new Date().toISOString();
      const issue = await createGitHubIssue(requirement);
      const executor = await triggerAiExecutor(requirement, issue?.url);
      const hasExecutor = Boolean(process.env.AI_ITERATION_WEBHOOK_URL);
      const requestLog = JSON.stringify({
        requirement,
        createdAt,
        status: hasExecutor
          ? executor?.ok
            ? 'sent_to_ai_executor'
            : 'executor_failed'
          : 'queued_without_executor',
        issueUrl: issue?.url || '',
        issueNumber: issue?.number || null,
        executorConfigured: hasExecutor,
        executorStatus: executor?.status || null,
        guardrails: [
          '先生成变更日志，再由管理员确认是否上线',
          '默认不改支付、授权、权限、数据库结构和生产数据',
          '必须通过 lint/build 后才能推送',
        ],
      });

      await saveSetting(SETTING_KEYS.lastRequest, requestLog);
      await logOperation(
        admin.userId,
        admin.username,
        'auto_iteration_trigger',
        `提交 AI 迭代请求：${requirement}。${hasExecutor ? '已尝试发送给 AI 执行器。' : '未配置 AI 执行器，当前只记录请求。'}${issue?.url ? ` GitHub Issue：${issue.url}` : ''}`,
      );

      return NextResponse.json({
        message: hasExecutor
          ? executor?.ok
            ? '已提交给 AI 执行器'
            : '已记录请求，但 AI 执行器调用失败'
          : '已记录迭代请求，但还没接入真正的 AI 执行器',
        changeLog: [
          issue?.url ? `已创建 GitHub Issue：${issue.url}` : '未配置 GITHUB_TOKEN，未创建 GitHub Issue',
          hasExecutor ? '已尝试通知 AI 执行器' : '未配置 AI_ITERATION_WEBHOOK_URL，后台不会自动改代码',
          '未确认上线前，不应主动触发生产发布',
        ],
        config: await readConfig(),
      });
    }

    if (action === 'approve_deploy') {
      const approvedAt = new Date().toISOString();
      const deployHook = process.env.VERCEL_DEPLOY_HOOK_URL;
      let deployMessage = '已记录上线确认。未配置 Vercel Deploy Hook 时，请以 GitHub/Vercel 后台实际部署状态为准。';

      if (deployHook) {
        const deployRes = await fetch(deployHook, { method: 'POST' });
        if (!deployRes.ok) {
          return NextResponse.json(
            { error: '已收到确认，但触发 Vercel Deploy Hook 失败，请到 Vercel 后台查看' },
            { status: 502 },
          );
        }
        deployMessage = '已确认并触发 Vercel 重新部署。';
      }

      await saveSetting(
        SETTING_KEYS.lastDeployApproval,
        JSON.stringify({ approvedAt, username: admin.username, deployHookTriggered: Boolean(deployHook) }),
      );
      await logOperation(
        admin.userId,
        admin.username,
        'auto_iteration_deploy_approved',
        `管理员确认上线：${deployHook ? '已触发 Vercel Deploy Hook' : '已记录确认，未配置 Deploy Hook'}`,
      );

      return NextResponse.json({
        message: deployMessage,
        config: await readConfig(),
      });
    }

    return NextResponse.json(
      { error: '未知操作，请使用 update_config、trigger_inspection 或 approve_deploy' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[AUTO ITERATION POST ERROR]', error);
    return NextResponse.json({ error: '自动迭代操作失败' }, { status: 500 });
  }
}
