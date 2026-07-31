import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { generateToken } from '@/lib/auth';

/**
 * POST /api/oauth/token - OAuth 2.0 Token 端点
 *
 * 支持 grant_type=authorization_code:
 *   body: { grant_type, code, redirect_uri, client_id, client_secret }
 *
 * 返回:
 *   { access_token, token_type: "Bearer", expires_in, scope }
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let grantType: string;
    let code: string;
    let redirectUri: string;
    let clientId: string;
    let clientSecret: string;

    // 支持 application/json 和 application/x-www-form-urlencoded
    if (contentType.includes('application/json')) {
      const body = await request.json();
      grantType = body.grant_type;
      code = body.code;
      redirectUri = body.redirect_uri;
      clientId = body.client_id;
      clientSecret = body.client_secret;
    } else {
      const formData = await request.formData();
      grantType = formData.get('grant_type') as string;
      code = formData.get('code') as string;
      redirectUri = formData.get('redirect_uri') as string;
      clientId = formData.get('client_id') as string;
      clientSecret = formData.get('client_secret') as string;
    }

    if (grantType !== 'authorization_code') {
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: '仅支持 authorization_code' },
        { status: 400 }
      );
    }

    if (!code || !redirectUri || !clientId) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: '参数缺失' },
        { status: 400 }
      );
    }

    // ---- 查找应用并验证 client_secret ----
    const app = await prisma.oAuthApp.findUnique({
      where: { clientId },
    });

    if (!app || app.status !== 'active') {
      return NextResponse.json(
        { error: 'invalid_client', error_description: '应用不存在或已禁用' },
        { status: 401 }
      );
    }

    if (app.clientSecret !== clientSecret) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'client_secret 不正确' },
        { status: 401 }
      );
    }

    // ---- 查找授权码 ----
    const authCode = await prisma.oAuthAuthorizationCode.findUnique({
      where: { code },
    });

    if (!authCode) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: '授权码无效' },
        { status: 400 }
      );
    }

    // 检查是否已使用
    if (authCode.used) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: '授权码已使用' },
        { status: 400 }
      );
    }

    // 检查是否过期
    if (authCode.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: '授权码已过期' },
        { status: 400 }
      );
    }

    // 检查 redirect_uri 一致性
    if (authCode.redirectUri !== redirectUri) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'redirect_uri 不匹配' },
        { status: 400 }
      );
    }

    // 检查 appId 一致性
    if (authCode.appId !== app.id) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: '授权码与应用不匹配' },
        { status: 400 }
      );
    }

    // ---- 标记授权码已使用 ----
    await prisma.oAuthAuthorizationCode.update({
      where: { id: authCode.id },
      data: { used: true },
    });

    // ---- 生成 access_token ----
    const accessToken = crypto.randomBytes(32).toString('hex');
    const expiresIn = 7 * 24 * 60 * 60; // 7 天
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await prisma.oAuthAccessToken.create({
      data: {
        appId: app.id,
        userId: authCode.userId,
        token: accessToken,
        scope: authCode.scope,
        expiresAt,
      },
    });

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope: authCode.scope || '',
    });
  } catch (error) {
    console.error('[OAUTH TOKEN ERROR]', error);
    return NextResponse.json(
      { error: 'server_error', error_description: '获取令牌失败' },
      { status: 500 }
    );
  }
}
