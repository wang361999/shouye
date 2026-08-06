import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/auth';
import { applyChanges, type FileChange, type RepoContext } from '@/lib/github-file-api';

/**
 * POST /api/coder/apply
 *
 * 应用 AI 提出的文件变更到 GitHub 仓库
 * 每个文件变更会创建一个 commit 并自动推送
 *
 * 请求体：
 *   { changes: FileChange[], commitMessage?: string, repo?: string, branch?: string }
 *
 * 返回：
 *   { success: boolean, results: ApplyResult[] }
 */
export async function POST(request: NextRequest) {
  const authResult = adminAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const body = await request.json();
    const { changes, commitMessage = 'AI 编程助手修改', repo, branch }: {
      changes: FileChange[];
      commitMessage?: string;
      repo?: string;
      branch?: string;
    } = body;

    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({ error: '没有需要应用的变更' }, { status: 400 });
    }

    const ctx: Partial<RepoContext> = {};
    if (repo) ctx.repo = repo;
    if (branch) ctx.branch = branch;

    const results = await applyChanges(changes, commitMessage, ctx);

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      summary: `成功 ${successCount} 个，失败 ${failCount} 个`,
      results,
    });
  } catch (error) {
    console.error('[CODER APPLY ERROR]', error);
    return NextResponse.json(
      {
        error: '应用变更失败',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
