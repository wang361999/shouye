import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getGitHubOAuthConfig } from '@/lib/oauth-config';

/** GET /api/auth/github - 重定向到 GitHub 授权页面 */
export async function GET(request: NextRequest) {
  const config = await getGitHubOAuthConfig();

  if (!config.clientId) {
    return NextResponse.json(
      { error: 'GitHub OAuth 配置缺失，请在后台安全设置中配置 GitHub Client ID 和 Secret' },
      { status: 500 }
    );
  }

  // ---- 生成随机 state，防止 CSRF ----
  const state = crypto.randomBytes(16).toString('hex');

  // ---- 构造 redirect_uri，指向回调接口 ----
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectUri = `${appUrl}/api/auth/github/callback`;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: 'user:email',
    state,
  });

  const githubAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  const response = NextResponse.redirect(githubAuthUrl);

  // ---- 将 state 存入 cookie，回调时校验一致性 ----
  response.cookies.set('github_oauth_state', state, {
    httpOnly: true,
    path: '/',
    maxAge: 600, // 10 分钟有效
    sameSite: 'lax',
  });

  return response;
}
