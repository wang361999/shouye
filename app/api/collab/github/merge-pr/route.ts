import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import {
  mergeGithubPullRequest,
  getGithubToken,
  isProjectManager,
} from '@/lib/collab';

export const dynamic = 'force-dynamic';

// ============ POST /api/collab/github/merge-pr - 合并 Pull Request ============
// 需要登录 + 项目管理员权限（owner / maintainer）
// body: { owner, repo, prNumber, projectId, commitTitle?, commitMessage?, mergeMethod? }
// 返回 { success, message, merged, sha? }
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const {
      owner,
      repo,
      prNumber,
      projectId,
      commitTitle,
      commitMessage,
      mergeMethod,
    } = body;

    // ---- 输入校验 ----
    if (!owner || !repo || !prNumber || !projectId) {
      return NextResponse.json(
        { error: '缺少必要参数 owner、repo、prNumber 或 projectId' },
        { status: 400 },
      );
    }

    // ---- 权限检查：只有项目 owner/maintainer 可合并 PR ----
    const isManager = await isProjectManager(projectId, user.userId);
    if (!isManager) {
      return NextResponse.json(
        { error: '只有项目发起人或管理员可以审核合并 PR' },
        { status: 403 },
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

    // ---- 调用 GitHub API 合并 PR ----
    const result = await mergeGithubPullRequest(
      owner,
      repo,
      Number(prNumber),
      commitTitle,
      commitMessage,
      mergeMethod || 'merge',
    );

    if (!result.success || !result.merged) {
      return NextResponse.json(
        { error: result.message },
        { status: 500 },
      );
    }

    // ---- 合并成功后，自动记录贡献 ----
    try {
      console.log(
        `[PR MERGE SUCCESS] PR #${prNumber} merged by user ${user.userId} for project ${projectId}`,
      );
    } catch {
      // 贡献记录更新失败不影响合并结果
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      merged: true,
      sha: result.sha,
    });
  } catch (error) {
    console.error('[COLLAB GITHUB MERGE PR ERROR]', error);
    return NextResponse.json(
      { error: '合并 PR 失败' },
      { status: 500 },
    );
  }
}

// ============ DELETE /api/collab/github/merge-pr - 关闭 PR（拒绝审核） ============
// 需要登录 + 项目管理员权限
// body: { owner, repo, prNumber, projectId }
export async function PATCH(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { owner, repo, prNumber, projectId } = body;

    if (!owner || !repo || !prNumber || !projectId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 },
      );
    }

    // 权限检查
    const isManager = await isProjectManager(projectId, user.userId);
    if (!isManager) {
      return NextResponse.json(
        { error: '只有项目发起人或管理员可以关闭 PR' },
        { status: 403 },
      );
    }

    const token = await getGithubToken();
    if (!token) {
      return NextResponse.json(
        { error: '尚未配置 GitHub Token' },
        { status: 503 },
      );
    }

    // 调用 GitHub API 关闭 PR
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ET-Studio-Collab',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'closed' }),
      },
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      return NextResponse.json(
        { error: errData?.message || '关闭 PR 失败' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'PR 已关闭',
    });
  } catch (error) {
    console.error('[COLLAB GITHUB CLOSE PR ERROR]', error);
    return NextResponse.json(
      { error: '关闭 PR 失败' },
      { status: 500 },
    );
  }
}
