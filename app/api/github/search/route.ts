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
 * GET /api/github/search?q=...&page=1&per_page=10&language=...&repo=...&user=...&extension=...
 *
 * 搜索 GitHub 代码
 * 支持筛选条件：
 *   - language: 编程语言（如 typescript, python, go）
 *   - repo: 限定仓库（格式: owner/repo）
 *   - user: 限定用户/组织
 *   - extension: 文件扩展名（如 ts, py, go）
 *   - filename: 文件名关键词
 *   - size: 文件大小范围（如 ">1000"）
 *
 * Token 来源优先级：环境变量 GITHUB_TOKEN > 数据库 SystemSetting.github_token
 * GitHub Code Search API: https://docs.github.com/en/rest/search#search-code
 *
 * 返回：
 *   { results, totalCount, page, perPage }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '10', 10), 30);

    // 筛选条件
    const language = searchParams.get('language') || '';
    const repo = searchParams.get('repo') || '';
    const user = searchParams.get('user') || '';
    const extension = searchParams.get('extension') || '';
    const filename = searchParams.get('filename') || '';
    const size = searchParams.get('size') || '';

    if (!q || q.trim().length < 2) {
      return NextResponse.json(
        { error: '搜索关键词至少需要 2 个字符' },
        { status: 400 }
      );
    }

    // 构建搜索查询字符串
    // GitHub Code Search 支持限定符语法: keyword language:typescript repo:owner/repo extension:ts
    let searchQuery = q.trim();

    if (language) {
      searchQuery += ` language:${language}`;
    }
    if (repo) {
      // 支持 owner/repo 格式
      const repoStr = repo.includes('/') ? repo : repo;
      searchQuery += ` repo:${repoStr}`;
    }
    if (user) {
      searchQuery += ` user:${user}`;
    }
    if (extension) {
      searchQuery += ` extension:${extension.replace(/^\./, '')}`;
    }
    if (filename) {
      searchQuery += ` filename:${filename}`;
    }
    if (size) {
      // 支持格式: ">1000" 或 "1000..5000"
      searchQuery += ` size:${size}`;
    }

    // 构建 GitHub Code Search API URL
    const searchUrl = new URL('https://api.github.com/search/code');
    searchUrl.searchParams.set('q', searchQuery);
    searchUrl.searchParams.set('page', String(page));
    searchUrl.searchParams.set('per_page', String(perPage));

    // 构建请求头
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ET-Studio-Forum',
    };

    // 获取 Token（环境变量优先，数据库回退）
    const token = await getGithubToken();
    if (!token) {
      return NextResponse.json(
        {
          error: 'GitHub 代码搜索需要配置 GITHUB_TOKEN。请前往后台 → 安全设置 → GitHub API Token 中配置，或在 Vercel 环境变量中添加 GITHUB_TOKEN。',
        },
        { status: 503 }
      );
    }
    headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(searchUrl.toString(), { headers });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'GITHUB_TOKEN 无效或已过期，请检查后台安全设置或 Vercel 环境变量中的 Token 配置' },
          { status: 503 }
        );
      }
      if (response.status === 403) {
        // 检查是否是速率限制
        const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
        if (rateLimitRemaining === '0') {
          const resetTime = response.headers.get('x-ratelimit-reset');
          const resetDate = resetTime
            ? new Date(parseInt(resetTime) * 1000).toLocaleTimeString('zh-CN')
            : '稍后';
          return NextResponse.json(
            {
              error: `GitHub API 速率限制已用尽，将在 ${resetDate} 重置。`,
            },
            { status: 429 }
          );
        }
        return NextResponse.json(
          { error: 'GitHub API 拒绝访问，请稍后再试' },
          { status: 429 }
        );
      }
      if (response.status === 422) {
        const errorData = await response.json().catch(() => null);
        return NextResponse.json(
          { error: errorData?.message || '搜索条件无效，GitHub Code Search 要求关键词中包含至少一个搜索词' },
          { status: 422 }
        );
      }
      return NextResponse.json(
        { error: `GitHub 搜索失败: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 格式化搜索结果
    const results = (data.items || []).map((item: any) => ({
      id: item.sha || `${item.repository.full_name}/${item.path}`,
      name: item.name,
      path: item.path,
      repo: {
        name: item.repository.full_name,
        url: item.repository.html_url,
      },
      htmlUrl: item.html_url,
      owner: item.repository.owner?.login || item.repository.full_name.split('/')[0],
      repoName: item.repository.full_name.split('/')[1] || '',
      filePath: item.path,
    }));

    return NextResponse.json({
      results,
      totalCount: data.total_count || 0,
      page,
      perPage,
      // 返回当前筛选条件，方便前端回显
      filters: {
        language,
        repo,
        user,
        extension,
        filename,
        size,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[GITHUB SEARCH ERROR]', error);
    return NextResponse.json(
      { error: 'GitHub 代码搜索失败' },
      { status: 500 }
    );
  }
}
