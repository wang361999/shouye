import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getGithubToken, updateGithubFile } from '@/lib/collab';

export const dynamic = 'force-dynamic';

// ============ PUT /api/collab/github/edit-file - 创建或更新 GitHub 仓库文件 ============
// 需要登录
// body: { owner, repo, path, content, message, branch, sha? }
// sha 为可选参数：更新已有文件时传入，新建文件时不传
// 返回 { sha, commitSha }
export async function PUT(request: NextRequest) {
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
    const { owner, repo, path, content, message, branch, sha } = body;

    // ---- 输入校验 ----
    if (!owner || !repo || !path || !branch) {
      return NextResponse.json(
        { error: '缺少必要参数 owner、repo、path 或 branch' },
        { status: 400 },
      );
    }

    if (content === undefined || content === null) {
      return NextResponse.json(
        { error: '文件内容不能为空' },
        { status: 400 },
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: 'commit 消息不能为空' },
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

    // ---- 调用 GitHub API 创建/更新文件 ----
    const result = await updateGithubFile(
      owner,
      repo,
      path,
      content,
      message,
      branch,
      sha,
    );

    if (!result) {
      return NextResponse.json(
        { error: '创建或更新文件失败，请检查路径、分支或文件 SHA 是否正确' },
        { status: 500 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[COLLAB GITHUB EDIT FILE ERROR]', error);
    return NextResponse.json(
      { error: '创建或更新 GitHub 文件失败' },
      { status: 500 },
    );
  }
}
