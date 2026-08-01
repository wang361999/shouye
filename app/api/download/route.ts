import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/download?repo=https://github.com/wang361999/gengxin[&branch=main]
 *
 * 将 GitHub 仓库地址转换为 ZIP 压缩包下载链接，并 302 重定向到 GitHub codeload API
 * 支持的输入格式：
 *   - https://github.com/{owner}/{repo}
 *   - https://github.com/{owner}/{repo}.git
 *   - https://github.com/{owner}/{repo}/tree/{branch}
 *   - {owner}/{repo}
 *
 * 下载格式：https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{branch}
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repoUrl = searchParams.get('repo');
  const branch = searchParams.get('branch') || 'main';

  if (!repoUrl) {
    return NextResponse.json(
      { error: '缺少 repo 参数' },
      { status: 400 },
    );
  }

  // 解析 GitHub 仓库地址，提取 owner 和 repo
  let owner = '';
  let repo = '';

  // 去除首尾空白
  let url = repoUrl.trim();

  // 统一处理所有格式：
  //   https://github.com/{owner}/{repo}
  //   https://github.com/{owner}/{repo}.git
  //   https://github.com/{owner}/{repo}/tree/{branch}
  //   github.com/{owner}/{repo}
  //   {owner}/{repo}

  // 移除协议
  url = url.replace(/^https?:\/\//, '');
  // 移除 github.com/
  url = url.replace(/^github\.com\//, '');
  // 移除 .git 后缀
  url = url.replace(/\.git$/, '');
  // 移除 /tree/branch 后缀
  url = url.replace(/\/tree\/.*$/, '');

  const parts = url.split('/');
  if (parts.length >= 2) {
    owner = parts[0];
    repo = parts[1];
  }

  // 清理可能的尾部斜杠
  repo = repo.replace(/\/$/, '');

  if (!owner || !repo) {
    return NextResponse.json(
      { error: '无法解析仓库地址，请提供有效的 GitHub 仓库链接' },
      { status: 400 },
    );
  }

  // 构造 codeload 下载链接
  const downloadUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`;

  // 302 重定向到 GitHub ZIP 下载
  return NextResponse.redirect(downloadUrl, {
    status: 302,
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
}
