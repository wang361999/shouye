import { NextRequest, NextResponse } from 'next/server';
import { getGithubToken } from '@/lib/collab';

/**
 * AI 自动迭代执行器端点
 *
 * 当 Sentry 检测到错误并创建 GitHub Issue 后，本端点接收通知，
 * 给 Issue 添加 "ai-iteration" 标签，触发 GitHub Actions 中的
 * free-ai-issue-executor.yml 自动修复流程。
 *
 * 配置方式：
 *   将 AI_ITERATION_WEBHOOK_URL 环境变量设为：
 *   https://www.gitd.cn/api/auto-iteration/execute
 *
 * GitHub Actions 需要：
 *   - AI_API_KEY secret（Gemini API Key）
 *   - GITHUB_TOKEN secret（自动提供）
 */

const REPO = process.env.GITHUB_REPO || 'wang361999/shouye';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { issueUrl, requirement, source } = body;

    // 从 issueUrl 中提取 Issue 编号
    // 格式: https://github.com/owner/repo/issues/123
    let issueNumber: number | null = null;
    if (issueUrl) {
      const match = String(issueUrl).match(/\/issues\/(\d+)/);
      if (match) {
        issueNumber = parseInt(match[1], 10);
      }
    }

    if (!issueNumber) {
      return NextResponse.json(
        { ok: false, error: '无法从 issueUrl 提取 Issue 编号', issueUrl },
        { status: 400 },
      );
    }

    const token = await getGithubToken();
    if (!token) {
      return NextResponse.json(
        { ok: false, error: '未配置 GITHUB_TOKEN，无法操作 Issue' },
        { status: 500 },
      );
    }

    // ---- 1. 给 Issue 添加 "ai-iteration" 标签 ----
    // 这会触发 GitHub Actions free-ai-issue-executor.yml
    const labelRes = await fetch(
      `https://api.github.com/repos/${REPO}/issues/${issueNumber}/labels`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'shouye-auto-iteration',
        },
        body: JSON.stringify({ labels: ['ai-iteration'] }),
      },
    );

    const labelOk = labelRes.ok;

    // ---- 2. 在 Issue 上添加评论，说明已触发 AI 修复 ----
    const commentBody = [
      '## 🤖 AI 自动修复已触发',
      '',
      `**来源**: ${source || 'sentry_webhook'}`,
      `**需求**: ${requirement || 'Sentry 错误自动修复'}`,
      '',
      'AI 执行器（GitHub Actions + Gemini）已收到通知，即将开始分析并修复此问题。',
      '',
      '### 执行流程',
      '1. AI 读取 Issue 内容和相关代码',
      '2. 生成修复代码',
      '3. 运行 `npm run lint` 和 `npm run build` 验证',
      '4. 创建 PR 并请求合并',
      '',
      '---',
      `*触发时间: ${new Date().toISOString()}*`,
    ].join('\n');

    const commentRes = await fetch(
      `https://api.github.com/repos/${REPO}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'shouye-auto-iteration',
        },
        body: JSON.stringify({ body: commentBody }),
      },
    );

    const commentOk = commentRes.ok;

    return NextResponse.json({
      ok: true,
      issueNumber,
      labelAdded: labelOk,
      commentAdded: commentOk,
      message: labelOk
        ? '已给 Issue 添加 ai-iteration 标签，GitHub Actions 将自动触发 AI 修复'
        : '添加标签失败，请检查 GITHUB_TOKEN 权限',
      nextSteps: [
        '1. GitHub Actions 将在几秒内开始执行',
        '2. AI 会分析错误并生成修复代码',
        '3. 如果 lint/build 通过，PR 会自动合并',
        '4. Vercel 自动部署修复后的代码',
      ],
    });
  } catch (error) {
    console.error('[AUTO ITERATION EXECUTE ERROR]', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: '执行失败', detail: errMsg },
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
    endpoint: 'auto-iteration-execute',
    description: '接收 AI 迭代通知，触发 GitHub Actions 自动修复',
  });
}
