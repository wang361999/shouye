import { NextRequest, NextResponse } from 'next/server';
import { fetchGithubRepoInfo } from '@/lib/collab';

export const dynamic = 'force-dynamic';

// ============ GET /api/collab/github/repo-info - 获取 GitHub 仓库信息 ============
// 查询参数: owner, repo
// 返回仓库描述、默认分支、语言、star数、fork数、open_issues数等
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner') || '';
    const repo = searchParams.get('repo') || '';

    if (!owner || !repo) {
      return NextResponse.json(
        { error: '缺少必要参数 owner 或 repo' },
        { status: 400 },
      );
    }

    const repoInfo = await fetchGithubRepoInfo(owner, repo);

    if (!repoInfo) {
      return NextResponse.json(
        { error: '获取仓库信息失败，可能是仓库不存在或 GitHub Token 未配置' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: repoInfo });
  } catch (error) {
    console.error('[COLLAB GITHUB REPO INFO ERROR]', error);
    return NextResponse.json(
      { error: '获取 GitHub 仓库信息失败' },
      { status: 500 },
    );
  }
}
