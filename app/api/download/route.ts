import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/download?repo=https://github.com/wang361999/gengxin[&branch=main]
 *
 * 将 GitHub 仓库地址转换为 ZIP 压缩包下载链接，并 302 重定向到 GitHub codeload API
 * 自动通过 GitHub API 获取仓库默认分支（避免 main/master 问题）
 *
 * 支持的输入格式：
 *   - https://github.com/{owner}/{repo}
 *   - https://github.com/{owner}/{repo}.git
 *   - https://github.com/{owner}/{repo}/tree/{branch}
 *   - github.com/{owner}/{repo}
 *   - {owner}/{repo}
 *
 * 下载格式：https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{branch}
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repoUrl = searchParams.get('repo');
  const customBranch = searchParams.get('branch');

  if (!repoUrl) {
    return NextResponse.json(
      { error: '缺少 repo 参数' },
      { status: 400 },
    );
  }

  // ============ 解析 GitHub 仓库地址，提取 owner 和 repo ============
  let url = repoUrl.trim();

  // 统一处理所有格式
  url = url.replace(/^https?:\/\//, '');    // 移除协议
  url = url.replace(/^github\.com\//, '');   // 移除 github.com/
  url = url.replace(/\.git$/, '');           // 移除 .git 后缀
  url = url.replace(/\/tree\/.*$/, '');      // 移除 /tree/branch 后缀

  const parts = url.split('/');
  if (parts.length < 2) {
    return NextResponse.json(
      { error: '无法解析仓库地址，请提供有效的 GitHub 仓库链接' },
      { status: 400 },
    );
  }

  const owner = parts[0];
  const repo = parts[1].replace(/\/$/, '');  // 清理尾部斜杠

  if (!owner || !repo) {
    return NextResponse.json(
      { error: '无法解析仓库地址，请提供有效的 GitHub 仓库链接' },
      { status: 400 },
    );
  }

  // ============ 确定分支 ============
  let branch = customBranch;

  // 如果未指定分支，通过 GitHub API 获取默认分支
  if (!branch) {
    try {
      const repoInfoResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: { 'User-Agent': 'download-proxy' },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (repoInfoResponse.ok) {
        const repoInfo = await repoInfoResponse.json();
        branch = repoInfo.default_branch || 'main';
      } else {
        // API 调用失败，默认使用 main
        branch = 'main';
      }
    } catch {
      // 网络错误或超时，默认使用 main
      branch = 'main';
    }
  }

  // ============ 构造 codeload 下载链接并 302 重定向 ============
  const downloadUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`;

  return NextResponse.redirect(downloadUrl, {
    status: 302,
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
}
