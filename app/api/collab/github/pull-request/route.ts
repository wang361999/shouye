import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { createGithubPullRequest, getGithubToken } from '@/lib/collab';

export const dynamic = 'force-dynamic';

// ============ POST /api/collab/github/pull-request - 创建 GitHub Pull Request ============
// 需要登录
// body: { owner, repo, title, body, head, base?(可选) }
// 返回 { number, title, url, state }
export async function POST(request: NextRequest) {
  try {
    // ---- 登录鉴权 ----
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { owner, repo, title, body: prBody, head, base } = body;

    // ---- 输入校验 ----
    if (!owner || !repo) {
      return NextResponse.json(
        { error: '缺少必要参数 owner 或 repo' },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: 'PR 标题不能为空' },
        { status: 400 },
      );
    }

    if (!head) {
      return NextResponse.json(
        { error: '源分支 head 不能为空' },
        { status: 400 },
      );
    }

    // ---- 检查 GitHub Token ----
    const token = await getGithubToken();
    if (!token) {
      return NextResponse.json(
        {
          error:
            '尚未配置 GitHub Token。请前往后台 → 安全设置 → GitHub API Token 中配置，或在 Vercel 环境变量中添加 GITHUB_TOKEN。',
        },
        { status: 503 },
      );
    }

    // ---- 调用 GitHub API 创建 PR ----
    const result = await createGithubPullRequest(
      owner,
      repo,
      title,
      prBody ?? '',
      head,
      base,
    );

    if (!result.data) {
      return NextResponse.json(
        { error: result.error || '创建 Pull Request 失败' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        number: result.data.number,
        title: result.data.title,
        url: result.data.url,
        state: result.data.state,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[COLLAB GITHUB PULL REQUEST ERROR]', error);
    return NextResponse.json(
      { error: '创建 GitHub Pull Request 失败' },
      { status: 500 },
    );
  }
}
