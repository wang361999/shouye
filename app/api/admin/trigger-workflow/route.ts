import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { logOperation } from '@/lib/admin-log';

/**
 * 从环境变量或数据库获取 GitHub Token
 */
async function getGithubToken(): Promise<string | null> {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'github_token' },
    });
    return setting?.value || null;
  } catch {
    return null;
  }
}

/**
 * 获取 GitHub 仓库的 Owner 和 Repo
 */
function getGithubRepoInfo() {
  const repoEnv = process.env.GITHUB_REPOSITORY; // 格式: owner/repo
  if (repoEnv && repoEnv.includes('/')) {
    const [owner, repo] = repoEnv.split('/');
    return { owner, repo };
  }

  const vercelOwner = process.env.VERCEL_GIT_REPO_OWNER;
  const vercelRepo = process.env.VERCEL_GIT_REPO_SLUG;
  if (vercelOwner && vercelRepo) {
    return { owner: vercelOwner, repo: vercelRepo };
  }

  return { owner: 'wang361999', repo: 'shouye' }; // 默认回退值
}

// 支持单独触发的工作流白名单
const WORKFLOW_MAP: Record<string, { name: string; needsForce?: boolean }> = {
  'auto-content-creator.yml': { name: '自动写博客', needsForce: true },
  'auto-patrol.yml': { name: '自动巡检', needsForce: true },
  'auto-forum-poster.yml': { name: '自动发帖', needsForce: true },
  'auto-forum-reply.yml': { name: '自动回复', needsForce: true },
  'auto-categorizer.yml': { name: '自动分类', needsForce: true },
  'auto-announcer.yml': { name: '自动公告', needsForce: true },
  'auto-link-checker.yml': { name: '链接检查' },
  'auto-stale-cleanup.yml': { name: '过期清理' },
  'auto-seo-optimizer.yml': { name: 'SEO优化', needsForce: true },
  'auto-ai-agent-cleanup.yml': { name: 'AI代理清理' },
};

/**
 * POST /api/admin/trigger-workflow
 * 单独触发指定的 GitHub Actions 工作流
 *
 * Body: { "workflow": "auto-content-creator.yml" }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 管理员鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    // 2. 解析请求体
    const body = await request.json().catch(() => ({}));
    const workflowId = body.workflow as string | undefined;

    if (!workflowId) {
      return NextResponse.json(
        { error: '缺少 workflow 参数，请指定要触发的工作流文件名。' },
        { status: 400 },
      );
    }

    const wfInfo = WORKFLOW_MAP[workflowId];
    if (!wfInfo) {
      return NextResponse.json(
        { error: `不支持的工作流: ${workflowId}` },
        { status: 400 },
      );
    }

    // 3. 获取 GitHub Token
    const token = await getGithubToken();
    if (!token) {
      return NextResponse.json(
        { error: '触发失败：请先在"后台-安全设置"中配置 GitHub API Token (github_token) 或设置 GITHUB_TOKEN 环境变量。' },
        { status: 400 },
      );
    }

    const { owner, repo } = getGithubRepoInfo();
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;

    // 4. 构造 dispatch 请求体，对需要 force 的工作流自动传参
    const dispatchBody: { ref: string; inputs?: Record<string, string> } = {
      ref: 'main',
    };

    if (wfInfo.needsForce) {
      dispatchBody.inputs = { force: 'true' };
    }

    // 8 秒超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ET-Studio-Admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dispatchBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      let errorMsg = `GitHub API 返回错误: ${response.status}`;
      if (response.status === 422) {
        errorMsg = '工作流不存在或不支持手动触发';
      } else if (response.status === 404) {
        errorMsg = '仓库或工作流未找到';
      } else if (response.status === 403) {
        errorMsg = 'Token 权限不足';
      }
      console.error('[TRIGGER WORKFLOW ERROR]', errText);
      return NextResponse.json(
        { error: errorMsg },
        { status: response.status },
      );
    }

    // 5. 记录操作日志
    await logOperation(
      admin.userId,
      admin.username,
      'trigger_single_workflow',
      'Workflow',
      `手动触发工作流: ${wfInfo.name} (${workflowId})`,
    );

    return NextResponse.json({
      success: true,
      message: `「${wfInfo.name}」工作流已成功触发！`,
      workflow: workflowId,
      workflowName: wfInfo.name,
      repo: `${owner}/${repo}`,
    });
  } catch (error: any) {
    console.error('[TRIGGER SINGLE WORKFLOW ERROR]', error);
    const message = error.name === 'AbortError' ? '请求 GitHub 超时（限时 8 秒），请检查网络' : '触发失败，内部服务器错误';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
