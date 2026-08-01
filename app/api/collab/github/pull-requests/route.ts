import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { fetchGithubPullRequests } from '@/lib/collab';

export const dynamic = 'force-dynamic';

// ============ GET /api/collab/github/pull-requests - 获取仓库 PR 列表 ============
// 需要登录
// 查询参数: owner, repo, state?(open/closed/all, 默认 open)
// 返回 { data: GithubPRInfo[] }
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner') || '';
    const repo = searchParams.get('repo') || '';
    const state = searchParams.get('state') || 'open';

    if (!owner || !repo) {
      return NextResponse.json(
        { error: '缺少必要参数 owner 或 repo' },
        { status: 400 },
      );
    }

    const prs = await fetchGithubPullRequests(owner, repo, state, 30);

    return NextResponse.json({ data: prs });
  } catch (error) {
    console.error('[COLLAB GITHUB PR LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取 PR 列表失败' },
      { status: 500 },
    );
  }
}
