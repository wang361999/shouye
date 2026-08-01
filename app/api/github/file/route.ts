import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * 从环境变量或数据库获取 GitHub Token
 * 优先使用环境变量，回退到数据库 SystemSetting
 */
async function getGithubToken(): Promise<string | null> {
  // 优先使用环境变量
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  // 回退到数据库
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'github_token' },
    });
    return setting?.value || null;
  } catch {
    return null;
  }
}

/**
 * GET /api/github/file?owner=...&repo=...&path=...&ref=...
 *
 * 获取 GitHub 仓库中指定文件的原始内容
 * Token 来源优先级：环境变量 GITHUB_TOKEN > 数据库 SystemSetting.github_token
 * 配置后速率限制为 5000/h
 *
 * 返回：
 *   { content, language, size, htmlUrl }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const path = searchParams.get('path');
    const ref = searchParams.get('ref') || 'HEAD';

    if (!owner || !repo || !path) {
      return NextResponse.json(
        { error: '缺少必要参数: owner, repo, path' },
        { status: 400 }
      );
    }

    // 限制路径长度防止滥用
    if (path.length > 500) {
      return NextResponse.json(
        { error: '文件路径过长' },
        { status: 400 }
      );
    }

    // 构建 GitHub Raw Content URL
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;

    // 构建请求头
    const headers: Record<string, string> = {
      'Accept': 'text/plain',
      'User-Agent': 'ET-Studio-Forum',
    };

    // 获取 Token（环境变量优先，数据库回退）
    const token = await getGithubToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(rawUrl, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: '文件不存在，请检查 owner/repo/path 是否正确' },
          { status: 404 }
        );
      }
      if (response.status === 403) {
        return NextResponse.json(
          { error: 'GitHub API 速率限制，请稍后再试或配置 GITHUB_TOKEN' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `获取文件失败: ${response.status}` },
        { status: response.status }
      );
    }

    const content = await response.text();

    // 限制返回内容大小（最多 100KB）
    if (content.length > 100 * 1024) {
      return NextResponse.json(
        { error: '文件过大，仅支持嵌入 100KB 以内的文件' },
        { status: 413 }
      );
    }

    // 从文件扩展名推断语言
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
      js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
      py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
      c: 'c', cpp: 'cpp', cs: 'csharp', php: 'php', swift: 'swift',
      kt: 'kotlin', sh: 'bash', bash: 'bash', zsh: 'bash',
      yml: 'yaml', yaml: 'yaml', json: 'json', xml: 'xml',
      html: 'html', css: 'css', scss: 'scss', sql: 'sql',
      md: 'markdown', vue: 'vue', svelte: 'svelte',
      dockerfile: 'docker', gradle: 'groovy',
    };
    const language = languageMap[ext] || 'plaintext';

    // 构建 GitHub 页面链接
    const htmlUrl = `https://github.com/${owner}/${repo}/blob/${ref}/${path}`;

    return NextResponse.json({
      content,
      language,
      size: content.length,
      htmlUrl,
      owner,
      repo,
      path,
      ref,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('[GITHUB FILE ERROR]', error);
    return NextResponse.json(
      { error: '获取 GitHub 文件失败' },
      { status: 500 }
    );
  }
}
