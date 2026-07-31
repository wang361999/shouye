import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import { getGitHubOAuthConfig } from '@/lib/oauth-config';

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/** GET /api/auth/github/callback - GitHub OAuth 回调 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;

  // ---- 校验 state，防止 CSRF ----
  const storedState = request.cookies.get('github_oauth_state')?.value;
  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/login?error=github`);
  }

  // ---- 从数据库获取配置 ----
  const config = await getGitHubOAuthConfig();

  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(`${appUrl}/login?error=github`);
  }

  try {
    // ---- 用 code 换取 access_token ----
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
      }),
    });

    const tokenData: GitHubTokenResponse = await tokenRes.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/login?error=github`);
    }

    const accessToken = tokenData.access_token;

    // ---- 获取 GitHub 用户信息 ----
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${appUrl}/login?error=github`);
    }

    const githubUser: GitHubUserResponse = await userRes.json();
    const githubId = String(githubUser.id);

    // ---- 获取邮箱（user 接口可能不返回 primary email） ----
    let email = githubUser.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (emailsRes.ok) {
        const emails: GitHubEmail[] = await emailsRes.json();
        const primaryEmail =
          emails.find((e) => e.primary && e.verified) || emails[0];
        if (primaryEmail) email = primaryEmail.email;
      }
    }

    if (!email) {
      return NextResponse.redirect(`${appUrl}/login?error=github`);
    }

    const normalizedEmail = email.toLowerCase();

    // ---- 查找是否已有此 githubId 的用户 ----
    let user = await prisma.user.findUnique({
      where: { githubId },
    });

    if (!user) {
      // ---- 如果 githubId 为空但 email 已存在，则关联 githubId ----
      const existingByEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            githubId,
            githubLogin: githubUser.login,
            avatar: existingByEmail.avatar || githubUser.avatar_url,
          },
        });
      } else {
        // ---- 创建新用户 ----
        let username = githubUser.login;
        const existingUsername = await prisma.user.findUnique({
          where: { username },
        });
        if (existingUsername) {
          username = `${githubUser.login}_${crypto.randomBytes(3).toString('hex')}`;
        }

        const randomPassword = crypto.randomBytes(24).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        user = await prisma.user.create({
          data: {
            username,
            email: normalizedEmail,
            password: hashedPassword,
            role: 'USER',
            avatar: githubUser.avatar_url,
            githubId,
            githubLogin: githubUser.login,
          },
        });
      }
    }

    // ---- 生成 JWT token ----
    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    // ---- 设置 cookie 并重定向到首页（带成功提示） ----
    const response = NextResponse.redirect(`${appUrl}/?oauth_success=1`);
    response.cookies.set('token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 604800,
    });
    // 清理 state cookie
    response.cookies.set('github_oauth_state', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('[GITHUB OAUTH CALLBACK ERROR]', error);
    return NextResponse.redirect(`${appUrl}/login?error=github`);
  }
}
