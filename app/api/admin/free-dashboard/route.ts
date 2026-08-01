import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const REPO = 'wang361999/shouye';
const MAIN_BRANCH = 'main';

const FREE_LIMITS = {
  functionInvocations: 1_000_000,
  edgeRequests: 1_000_000,
  cpuTimeMs: 4 * 3600 * 1000,
  dataTransferBytes: 100 * 1024 * 1024 * 1024,
};

const AUTO_ITERATION_KEYS = [
  'auto_iteration_enabled',
  'auto_iteration_require_approval',
  'auto_iteration_safe_mode',
  'auto_iteration_last_request',
  'auto_iteration_last_deploy_approval',
];

type DeployStatus = 'success' | 'pending' | 'failure' | 'unknown';

type GitHubCommitItem = {
  sha?: string;
  html_url?: string;
  commit?: {
    message?: string;
    committer?: {
      date?: string;
    };
  };
};

async function fetchDeployStatus() {
  try {
    const commitRes = await fetch(`https://api.github.com/repos/${REPO}/commits/${MAIN_BRANCH}`, {
      next: { revalidate: 60 },
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'shouye-admin-dashboard',
      },
    });

    if (!commitRes.ok) {
      throw new Error('无法读取 GitHub 提交信息');
    }

    const commit = await commitRes.json();
    const sha = String(commit?.sha || '');

    const statusRes = await fetch(`https://api.github.com/repos/${REPO}/commits/${sha}/status`, {
      next: { revalidate: 60 },
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'shouye-admin-dashboard',
      },
    });

    const statusData = statusRes.ok ? await statusRes.json() : null;
    const state = (statusData?.state || 'unknown') as DeployStatus;
    const vercelStatus = Array.isArray(statusData?.statuses)
      ? statusData.statuses.find((item: { context?: string }) => item.context === 'Vercel')
      : null;

    return {
      state,
      sha,
      shortSha: sha.slice(0, 7),
      message: vercelStatus?.description || '暂未读取到 Vercel 状态',
      targetUrl: vercelStatus?.target_url || commit?.html_url || '',
      updatedAt: vercelStatus?.updated_at || commit?.commit?.committer?.date || null,
    };
  } catch {
    return {
      state: 'unknown' as DeployStatus,
      sha: '',
      shortSha: '',
      message: '无法读取 GitHub/Vercel 状态，请稍后刷新或到 Vercel 后台查看',
      targetUrl: '',
      updatedAt: null,
    };
  }
}

async function fetchRecentCodeIterations() {
  try {
    const commitsRes = await fetch(
      `https://api.github.com/repos/${REPO}/commits?sha=${MAIN_BRANCH}&per_page=5`,
      {
        next: { revalidate: 60 },
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'shouye-admin-dashboard',
        },
      },
    );

    if (!commitsRes.ok) {
      throw new Error('无法读取 GitHub 提交记录');
    }

    const commits = (await commitsRes.json()) as GitHubCommitItem[];
    return commits.map((item) => {
      const message = item.commit?.message || '无提交说明';
      return {
        sha: item.sha || '',
        shortSha: item.sha?.slice(0, 7) || '',
        title: message.split('\n')[0],
        detail: message,
        url: item.html_url || '',
        committedAt: item.commit?.committer?.date || null,
      };
    });
  } catch {
    return [];
  }
}

function percent(used: number, total: number) {
  if (!total) return 0;
  return Number(Math.min(100, (used / total) * 100).toFixed(2));
}

function getLevel(value: number) {
  if (value >= 90) return 'danger';
  if (value >= 70) return 'warning';
  return 'good';
}

function toBool(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value === 'true';
}

function getExecutorMode() {
  if (process.env.AI_ITERATION_WEBHOOK_URL) {
    return {
      aiExecutorConfigured: true,
      githubIssueConfigured: Boolean(process.env.GITHUB_TOKEN),
      requestQueueConfigured: true,
      executorMode: 'ai_webhook',
      executorName: '外部 AI 执行器',
    };
  }

  if (process.env.GITHUB_TOKEN) {
    return {
      aiExecutorConfigured: false,
      githubIssueConfigured: true,
      requestQueueConfigured: true,
      executorMode: 'github_issue_queue',
      executorName: 'GitHub Issue 迭代队列',
    };
  }

  return {
    aiExecutorConfigured: false,
    githubIssueConfigured: false,
    requestQueueConfigured: true,
    executorMode: 'operation_log_queue',
    executorName: '站内日志迭代队列',
  };
}

async function safeRead<T>(label: string, task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch (error) {
    console.error(`[FREE DASHBOARD PARTIAL ERROR] ${label}`, error);
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [deploy, codeIterations] = await Promise.all([
      fetchDeployStatus(),
      fetchRecentCodeIterations(),
    ]);

    const [
      toolCount,
      activeToolCount,
      userCount,
      postCount,
      todayPostCount,
      weekPostCount,
      pendingComments,
      pendingReports,
      pendingOrders,
      monthUsage,
      hotTools,
      recentLogs,
      autoIterationSettings,
    ] = await Promise.all([
      safeRead('toolCount', prisma.tool.count(), 0),
      safeRead('activeToolCount', prisma.tool.count({ where: { isActive: true } }), 0),
      safeRead('userCount', prisma.user.count(), 0),
      safeRead('postCount', prisma.post.count({ where: { status: { not: 'DELETED' } } }), 0),
      safeRead(
        'todayPostCount',
        prisma.post.count({
          where: { status: { not: 'DELETED' }, createdAt: { gte: todayStart } },
        }),
        0,
      ),
      safeRead(
        'weekPostCount',
        prisma.post.count({
          where: { status: { not: 'DELETED' }, createdAt: { gte: weekStart } },
        }),
        0,
      ),
      safeRead('pendingComments', prisma.comment.count({ where: { isApproved: false, deletedAt: null } }), 0),
      safeRead('pendingReports', prisma.report.count({ where: { status: 'pending' } }), 0),
      safeRead('pendingOrders', prisma.order.count({ where: { status: { in: ['pending', 'paid'] } } }), 0),
      safeRead(
        'monthUsage',
        prisma.monitoringDaily.aggregate({
          where: { date: { gte: monthStart, lt: monthEnd } },
          _sum: {
            functionInvocations: true,
            edgeRequests: true,
            cpuTimeMs: true,
            dataTransferBytes: true,
          },
        }),
        {
          _sum: {
            functionInvocations: 0,
            edgeRequests: 0,
            cpuTimeMs: 0,
            dataTransferBytes: BigInt(0),
          },
        },
      ),
      safeRead(
        'hotTools',
        prisma.tool.findMany({
          where: { isActive: true },
          orderBy: { clickCount: 'desc' },
          take: 5,
          select: { id: true, name: true, icon: true, clickCount: true, category: true },
        }),
        [],
      ),
      safeRead(
        'recentLogs',
        prisma.operationLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: { id: true, username: true, action: true, detail: true, createdAt: true },
        }),
        [],
      ),
      safeRead(
        'autoIterationSettings',
        prisma.systemSetting.findMany({
          where: { key: { in: AUTO_ITERATION_KEYS } },
        }),
        [],
      ),
    ]);

    const autoIterationMap = Object.fromEntries(
      autoIterationSettings.map((item) => [item.key, item.value]),
    );

    const usage = {
      functionInvocations: Number(monthUsage._sum.functionInvocations || 0),
      edgeRequests: Number(monthUsage._sum.edgeRequests || 0),
      cpuTimeMs: Number(monthUsage._sum.cpuTimeMs || 0),
      dataTransferBytes: Number(monthUsage._sum.dataTransferBytes || 0),
    };

    const quotas = [
      {
        key: 'functionInvocations',
        label: '函数调用',
        used: usage.functionInvocations,
        total: FREE_LIMITS.functionInvocations,
        unit: '次',
        percent: percent(usage.functionInvocations, FREE_LIMITS.functionInvocations),
      },
      {
        key: 'edgeRequests',
        label: '页面/API 请求',
        used: usage.edgeRequests,
        total: FREE_LIMITS.edgeRequests,
        unit: '次',
        percent: percent(usage.edgeRequests, FREE_LIMITS.edgeRequests),
      },
      {
        key: 'cpuTime',
        label: '计算时间',
        used: usage.cpuTimeMs,
        total: FREE_LIMITS.cpuTimeMs,
        unit: 'ms',
        percent: percent(usage.cpuTimeMs, FREE_LIMITS.cpuTimeMs),
      },
      {
        key: 'dataTransfer',
        label: '流量',
        used: usage.dataTransferBytes,
        total: FREE_LIMITS.dataTransferBytes,
        unit: 'bytes',
        percent: percent(usage.dataTransferBytes, FREE_LIMITS.dataTransferBytes),
      },
    ].map((item) => ({ ...item, level: getLevel(item.percent) }));

    const maxQuotaPercent = Math.max(...quotas.map((item) => item.percent), 0);
    const pendingTotal = pendingComments + pendingReports + pendingOrders;
    const healthScore = Math.max(
      0,
      100
        - (deploy.state === 'failure' ? 30 : deploy.state === 'pending' ? 8 : deploy.state === 'unknown' ? 10 : 0)
        - (maxQuotaPercent >= 90 ? 25 : maxQuotaPercent >= 70 ? 10 : 0)
        - Math.min(25, pendingTotal * 3),
    );

    const tasks = [
      {
        title: '处理待审评论',
        count: pendingComments,
        href: '/admin/forum/comments',
        level: pendingComments > 0 ? 'warning' : 'good',
        desc: pendingComments > 0 ? '有评论等待审核，建议优先处理' : '暂无待审评论',
      },
      {
        title: '处理用户举报',
        count: pendingReports,
        href: '/admin/forum/reports',
        level: pendingReports > 0 ? 'warning' : 'good',
        desc: pendingReports > 0 ? '有举报未处理，避免社区内容失控' : '暂无待处理举报',
      },
      {
        title: '处理订单/授权',
        count: pendingOrders,
        href: '/admin/orders',
        level: pendingOrders > 0 ? 'warning' : 'good',
        desc: pendingOrders > 0 ? '有订单可能需要确认收款或审核' : '暂无待处理订单',
      },
    ];

    const suggestions = [
      deploy.state === 'pending'
        ? 'Vercel 正在部署，等它完成后再验证新功能。'
        : deploy.state === 'failure'
          ? '部署失败，先打开部署详情查看构建日志。'
          : deploy.state === 'success'
            ? '部署正常，可以继续做小功能迭代。'
            : '暂时无法读取部署状态，必要时去 Vercel 后台确认。',
      maxQuotaPercent >= 70
        ? '免费额度使用偏高，先优化热门路由和图片资源。'
        : '免费额度充足，当前不用购买服务器或付费监控。',
      pendingTotal > 0
        ? '先清理待处理事项，再继续新增功能。'
        : '后台待办清爽，可以推进下一个功能。',
      'Token、数据库密码、Vercel 环境变量不要写进代码，继续放在平台环境变量里。',
    ];

    return NextResponse.json({
      health: {
        score: Math.round(healthScore),
        level: healthScore >= 85 ? 'good' : healthScore >= 65 ? 'warning' : 'danger',
        summary:
          healthScore >= 85
            ? '整体正常，可以放心继续迭代'
            : healthScore >= 65
              ? '有少量事项需要关注'
              : '建议先处理风险项再开发新功能',
      },
      deploy,
      business: {
        toolCount,
        activeToolCount,
        userCount,
        postCount,
        todayPostCount,
        weekPostCount,
      },
      freeQuota: {
        monthStart: monthStart.toISOString().split('T')[0],
        monthEnd: new Date(monthEnd.getTime() - 86400000).toISOString().split('T')[0],
        maxPercent: maxQuotaPercent,
        quotas,
      },
      tasks,
      suggestions,
      hotTools,
      recentLogs,
      codeIterations,
      visibleChanges: [
        {
          title: '免费看板增加 AI 自动迭代实验区',
          desc: '可以开启实验、触发巡检、记录“我确认，可以上线”。',
          href: '/admin/free-dashboard',
          tag: '后台入口',
        },
        {
          title: '用量监控改成站内真实埋点趋势',
          desc: '显示最近入库时间、路由样本数，并明确不是 Vercel 官方账单。',
          href: '/admin/monitoring',
          tag: '监控修复',
        },
        {
          title: '自动迭代和部署说明已写进文档',
          desc: '补充先出日志、再由管理员确认上线的免费流程。',
          href: '/docs',
          tag: '文档',
        },
      ],
      autoIteration: {
        enabled: toBool(autoIterationMap.auto_iteration_enabled, false),
        requireApproval: toBool(autoIterationMap.auto_iteration_require_approval, true),
        safeMode: toBool(autoIterationMap.auto_iteration_safe_mode, true),
        lastRequest: autoIterationMap.auto_iteration_last_request || '',
        lastDeployApproval: autoIterationMap.auto_iteration_last_deploy_approval || '',
        manualDeployConfigured: Boolean(process.env.VERCEL_DEPLOY_HOOK_URL),
        ...getExecutorMode(),
      },
      freeStack: [
        { name: '代码托管', value: 'GitHub 免费仓库', status: '已使用' },
        { name: '自动部署', value: 'Vercel 免费额度', status: '已接入' },
        { name: '数据库', value: 'PostgreSQL 免费额度优先', status: '需保证环境变量正确' },
        { name: '监控', value: '项目内置监控看板', status: '已接入' },
        { name: 'AI 迭代', value: '按需求人工触发 AI 修改', status: '免费优先' },
      ],
    });
  } catch (error) {
    console.error('[FREE DASHBOARD ERROR]', error);
    return NextResponse.json({ error: '获取免费运营看板失败' }, { status: 500 });
  }
}
