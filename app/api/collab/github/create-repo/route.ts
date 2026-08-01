import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { getGithubToken, buildGithubHeaders } from '@/lib/collab';

export const dynamic = 'force-dynamic';

// ============ POST /api/collab/github/create-repo - 通过 GitHub API 创建新仓库 ============
// 需要登录且已绑定 GitHub
// body: name, description, private(bool), autoInit(bool)
// 使用用户的 GitHub OAuth token 或系统 token 调用 GitHub API
// 返回创建的仓库信息（html_url, full_name, default_branch）
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
    const { name, description, private: isPrivate, autoInit } = body;

    // ---- 输入校验 ----
    if (!name) {
      return NextResponse.json(
        { error: '仓库名称不能为空' },
        { status: 400 },
      );
    }

    // GitHub 仓库名规则：字母、数字、-、_、.
    if (!/^[a-zA-Z0-9._-]+$/.test(name) || name.length > 100) {
      return NextResponse.json(
        { error: '仓库名称只能包含字母、数字、连字符、下划线和点，且不超过 100 个字符' },
        { status: 400 },
      );
    }

    // ---- 获取用户绑定的 GitHub 信息 ----
    const userInfo = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { githubId: true, githubLogin: true },
    });

    // ---- 获取可用 Token ----
    // 优先使用系统配置的 Token；用户 OAuth token 未持久化存储，因此统一使用系统 token
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

    // ---- 调用 GitHub API 创建仓库 ----
    const headers = buildGithubHeaders(token);
    headers['Content-Type'] = 'application/json';

    const createResponse = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        description: description || undefined,
        private: !!isPrivate,
        auto_init: !!autoInit,
      }),
    });

    // ---- 处理 GitHub API 错误 ----
    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => null);

      if (createResponse.status === 401) {
        return NextResponse.json(
          { error: 'GitHub Token 无效或已过期，请检查后台安全设置或 Vercel 环境变量' },
          { status: 503 },
        );
      }

      if (createResponse.status === 403) {
        const rateLimitRemaining = createResponse.headers.get(
          'x-ratelimit-remaining',
        );
        if (rateLimitRemaining === '0') {
          return NextResponse.json(
            { error: 'GitHub API 速率限制已用尽，请稍后再试' },
            { status: 429 },
          );
        }
        return NextResponse.json(
          { error: errorData?.message || 'GitHub API 拒绝访问，请稍后再试' },
          { status: 429 },
        );
      }

      if (createResponse.status === 422) {
        return NextResponse.json(
          {
            error:
              errorData?.errors?.[0]?.message ||
              errorData?.message ||
              '仓库名称已存在或不符合规范',
          },
          { status: 422 },
        );
      }

      return NextResponse.json(
        {
          error:
            errorData?.message || `创建仓库失败: ${createResponse.status}`,
        },
        { status: createResponse.status },
      );
    }

    const repoData = await createResponse.json();

    // ---- 返回创建的仓库信息 ----
    return NextResponse.json(
      {
        id: repoData.id,
        name: repoData.name,
        fullName: repoData.full_name,
        htmlUrl: repoData.html_url,
        defaultBranch: repoData.default_branch || 'main',
        description: repoData.description ?? null,
        private: repoData.private ?? false,
        owner: repoData.owner?.login || userInfo?.githubLogin || null,
        createdAt: repoData.created_at,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[COLLAB GITHUB CREATE REPO ERROR]', error);
    return NextResponse.json(
      { error: '创建 GitHub 仓库失败' },
      { status: 500 },
    );
  }
}
