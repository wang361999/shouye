import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { fetchGithubContents, fetchGithubFile } from '@/lib/collab';

export const dynamic = 'force-dynamic';

// ============ GET /api/collab/github/contents - 获取 GitHub 仓库文件或目录内容 ============
// 查询参数: owner, repo, path(默认空字符串=根目录), ref(可选分支/commit/tag)
// path 指向目录时返回文件/目录列表数组，指向文件时返回文件内容（含 sha、content、path）
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
    const path = searchParams.get('path') || '';
    const ref = searchParams.get('ref') || undefined;

    // ---- 输入校验 ----
    if (!owner || !repo) {
      return NextResponse.json(
        { error: '缺少必要参数 owner 或 repo' },
        { status: 400 },
      );
    }

    // ---- 先尝试作为文件获取 ----
    const fileContent = await fetchGithubFile(owner, repo, path, ref);
    if (fileContent) {
      return NextResponse.json({ data: fileContent });
    }

    // ---- 文件不存在则尝试作为目录获取列表 ----
    const contents = await fetchGithubContents(owner, repo, path, ref);
    if (contents.length > 0) {
      return NextResponse.json({ data: contents });
    }

    // ---- 既不是文件也无法获取目录内容 ----
    return NextResponse.json(
      { error: '文件或目录不存在' },
      { status: 404 },
    );
  } catch (error) {
    console.error('[COLLAB GITHUB CONTENTS ERROR]', error);
    return NextResponse.json(
      { error: '获取 GitHub 仓库内容失败' },
      { status: 500 },
    );
  }
}
