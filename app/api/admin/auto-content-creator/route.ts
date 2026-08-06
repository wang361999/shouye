import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

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

/**
 * POST /api/admin/auto-content-creator - 触发 AI 自动写博客
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 管理员鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    // 8 秒超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const token = await getGithubToken();
    if (!token) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: '触发失败：请先在“后台-安全设置”中配置 GitHub API Token (github_token) 或设置 GITHUB_TOKEN 环境变量。' },
        { status: 400 }
      );
    }

    const { owner, repo } = getGithubRepoInfo();
    const workflowId = 'auto-content-creator.yml';

    // 2. 调用 GitHub API 触发 workflow_dispatch
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ET-Studio-Admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main', // 触发 main 分支的工作流
        inputs: {
          force: 'true', // 手动触发时强制执行，跳过时间校验
          post_topic: 'random',
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[TRIGGER WORKFLOW ERROR]', errText);
      return NextResponse.json(
        { error: `GitHub API 返回错误: ${response.status} - ${errText || '未知错误'}` },
        { status: response.status }
      );
    }

    // 3. 记录操作日志
    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'trigger_auto_content_creator',
        target: 'Workflow',
        detail: `触发自动写博客工作流 (${owner}/${repo})`,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'AI 自动写博客工作流已成功触发！预计将在 1-2 分钟内生成并在论坛中发布新文章。',
      repo: `${owner}/${repo}`,
      workflow: workflowId,
    });
  } catch (error: any) {
    console.error('[AUTO CONTENT CREATOR TRIGGER ERROR]', error);
    const message = error.name === 'AbortError' ? '请求 GitHub 超时（限时 8 秒），请检查网络' : '触发失败，内部服务器错误';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/auto-content-creator - 获取工作流触发状态和配置
 */
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const token = await getGithubToken();
    const { owner, repo } = getGithubRepoInfo();

    // 检查最近是否有触发成功的日志
    const lastLogs = await prisma.operationLog.findMany({
      where: { action: 'trigger_auto_content_creator' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      configured: !!token,
      repo: `${owner}/${repo}`,
      workflow: 'auto-content-creator.yml',
      lastTriggers: lastLogs.map((log: (typeof lastLogs)[number]) => ({
        id: log.id,
        username: log.username,
        detail: log.detail,
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error('[AUTO CONTENT CREATOR GET ERROR]', error);
    return NextResponse.json({ error: '获取工作流状态失败' }, { status: 500 });
  }
}
