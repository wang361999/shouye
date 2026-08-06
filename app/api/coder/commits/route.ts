import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/auth';
import { getRecentCommits, type RepoContext } from '@/lib/github-file-api';

/**
 * GET /api/coder/commits
 *
 * 获取最近的 Git 提交记录
 * 查询参数: count, repo, branch
 */
export async function GET(request: NextRequest) {
  const authResult = adminAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '5', 10);

    const ctx: Partial<RepoContext> = {};
    const repo = searchParams.get('repo');
    const branch = searchParams.get('branch');
    if (repo) ctx.repo = repo;
    if (branch) ctx.branch = branch;

    const commits = await getRecentCommits(Math.min(count, 20), ctx);
    return NextResponse.json({ commits });
  } catch (error) {
    console.error('[CODER COMMITS ERROR]', error);
    return NextResponse.json(
      { error: '获取提交记录失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
