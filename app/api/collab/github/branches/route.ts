import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import {
  fetchGithubBranches,
  createGithubBranch,
  getGithubToken,
} from '@/lib/collab';

export const dynamic = 'force-dynamic';

// ============ GET /api/collab/github/branches - 获取 GitHub 仓库分支列表 ============
// 查询参数: owner, repo
// 返回 { data: string[] } 分支名列表
export async function GET(request: NextRequest) {
  try {
    // ---- 登录鉴权 ----
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner') || '';
    const repo = searchParams.get('repo') || '';

    // ---- 输入校验 ----
    if (!owner || !repo) {
      return NextResponse.json(
        { error: '缺少必要参数 owner 或 repo' },
        { status: 400 },
      );
    }

    // ---- 获取分支列表 ----
    const branches = await fetchGithubBranches(owner, repo);

    return NextResponse.json({ data: branches });
  } catch (error) {
    console.error('[COLLAB GITHUB BRANCHES ERROR]', error);
    return NextResponse.json(
      { error: '获取 GitHub 分支列表失败' },
      { status: 500 },
    );
  }
}

// ============ POST /api/collab/github/branches - 创建 GitHub 分支 ============
// 需要登录
// body: { owner, repo, branchName, fromBranch?(可选) }
// 返回 { message: '分支创建成功', branchName }
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
    const { owner, repo, branchName, fromBranch } = body;

    // ---- 输入校验 ----
    if (!owner || !repo || !branchName) {
      return NextResponse.json(
        { error: '缺少必要参数 owner、repo 或 branchName' },
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

    // ---- 调用 GitHub API 创建分支 ----
    const success = await createGithubBranch(
      owner,
      repo,
      branchName,
      fromBranch,
    );

    if (!success) {
      return NextResponse.json(
        { error: '分支创建失败，可能是分支已存在或基准分支不存在' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: '分支创建成功', branchName },
      { status: 201 },
    );
  } catch (error) {
    console.error('[COLLAB GITHUB BRANCHES ERROR]', error);
    return NextResponse.json(
      { error: '创建 GitHub 分支失败' },
      { status: 500 },
    );
  }
}
