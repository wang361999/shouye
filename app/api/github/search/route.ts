import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/github/search?q=...&page=1&per_page=10
 *
 * 搜索 GitHub 代码
 * 必须配置 GITHUB_TOKEN 环境变量（GitHub Code Search API 强制要求认证）
 * 配置后速率限制为 5000/h
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

    if (!q || q.trim().length < 2) {
      return NextResponse.json(
        { error: '搜索关键词至少需要 2 个字符' },
        { status: 400 }
      );
    }

    // 构建 GitHub Code Search API URL
    const searchUrl = new URL('https://api.github.com/search/code');
    searchUrl.searchParams.set('q', q.trim());
    searchUrl.searchParams.set('page', String(page));
    searchUrl.searchParams.set('per_page', String(perPage));

    // 构建请求头
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ET-Studio-Forum',
    };

    // GitHub Code Search API 强制要求认证，无 Token 时直接返回友好错误
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        {
          error: 'GitHub 代码搜索需要配置 GITHUB_TOKEN 环境变量。请在 Vercel 项目设置 → Environment Variables 中添加 GITHUB_TOKEN（只需 public_repo 只读权限即可）。',
        },
        { status: 503 }
      );
    }
    headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(searchUrl.toString(), { headers });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'GITHUB_TOKEN 无效或已过期，请检查 Vercel 环境变量中的 Token 配置' },
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
              error: `GitHub API 速率限制已用尽，将在 ${resetDate} 重置。请在 Vercel 环境变量中配置 GITHUB_TOKEN 以提高限制。`,
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
