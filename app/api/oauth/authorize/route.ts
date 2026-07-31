import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getUserFromRequest, getTokenFromRequest } from '@/lib/auth';

/**
 * GET /api/oauth/authorize - OAuth 2.0 授权端点
 *
 * 参数:
 *   response_type = code (固定)
 *   client_id     = 应用的 Client ID
 *   redirect_uri  = 回调地址（必须与注册的一致）
 *   scope         = 授权范围（可选，如 "user:read user:email"）
 *   state         = 客户端生成的随机字符串（原样返回，防 CSRF）
 *
 * 流程:
 *   1. 校验 client_id 和 redirect_uri
 *   2. 若用户未登录 → 跳转登录页
 *   3. 若用户已登录 → 跳转到授权同意页 /oauth/authorize?...
 *   4. 用户同意后 → 生成授权码并重定向到 redirect_uri?code=xxx&state=xxx
 *   5. 用户拒绝 → 重定向到 redirect_uri?error=access_denied
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const responseType = searchParams.get('response_type');
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const scope = searchParams.get('scope') || '';
  const state = searchParams.get('state') || '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;

  // ---- 参数校验 ----
  if (responseType !== 'code') {
    return NextResponse.json(
      { error: 'unsupported_response_type', error_description: '仅支持 response_type=code' },
      { status: 400 }
    );
  }

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: '缺少 client_id 或 redirect_uri' },
      { status: 400 }
    );
  }

  // ---- 查找应用 ----
  let app;
  try {
    app = await prisma.oAuthApp.findUnique({
      where: { clientId },
    });
  } catch {
    return NextResponse.json(
      { error: 'server_error', error_description: '数据库不可用' },
      { status: 500 }
    );
  }

  if (!app || app.status !== 'active') {
    return NextResponse.json(
      { error: 'invalid_client', error_description: '应用不存在或已被禁用' },
      { status: 400 }
    );
  }

  // ---- 校验 redirect_uri ----
  let registeredUris: string[] = [];
  try {
    registeredUris = JSON.parse(app.redirectUris);
  } catch {
    registeredUris = [app.redirectUris];
  }

  if (!registeredUris.includes(redirectUri)) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'redirect_uri 与注册的不匹配' },
      { status: 400 }
    );
  }

  // ---- 检查用户是否已登录 ----
  const token = getTokenFromRequest(request);
  const userPayload = token ? getUserFromRequest(request) : null;

  if (!userPayload) {
    // 未登录 → 跳转登录页，登录后回到授权同意页
    const authorizeUrl = `/oauth/authorize?${searchParams.toString()}`;
    const loginUrl = `/login?redirect=${encodeURIComponent(authorizeUrl)}`;
    return NextResponse.redirect(`${appUrl}${loginUrl}`);
  }

  // ---- 已登录 → 检查是否已有 access_token（自动授权） ----
  let existingToken;
  try {
    existingToken = await prisma.oAuthAccessToken.findFirst({
      where: {
        appId: app.id,
        userId: userPayload.userId,
        expiresAt: { gt: new Date() },
      },
    });
  } catch {
    // 数据库错误时继续走手动授权流程
  }

  if (existingToken) {
    // 已有有效 token，自动生成授权码，跳过同意页
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟

    try {
      await prisma.oAuthAuthorizationCode.create({
        data: {
          appId: app.id,
          userId: userPayload.userId,
          code,
          redirectUri,
          scope: scope || existingToken.scope || null,
          expiresAt,
        },
      });
    } catch {
      return NextResponse.json(
        { error: 'server_error', error_description: '创建授权码失败' },
        { status: 500 }
      );
    }

    const callback = new URL(redirectUri);
    callback.searchParams.set('code', code);
    if (state) callback.searchParams.set('state', state);
    return NextResponse.redirect(callback.toString());
  }

  // ---- 跳转到授权同意页 ----
  const consentUrl = `/oauth/authorize?${searchParams.toString()}`;
  return NextResponse.redirect(`${appUrl}${consentUrl}`);
}

/**
 * POST /api/oauth/authorize - 用户同意/拒绝授权
 *
 * body: {
 *   client_id, redirect_uri, scope, state,
 *   action: "approve" | "deny"
 * }
 * 需要用户已登录
 */
export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: '请先登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { client_id, redirect_uri, scope, state, action } = body;

    if (!client_id || !redirect_uri) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: '参数缺失' },
        { status: 400 }
      );
    }

    // 查找应用
    const app = await prisma.oAuthApp.findUnique({
      where: { clientId: client_id },
    });

    if (!app || app.status !== 'active') {
      return NextResponse.json(
        { error: 'invalid_client', error_description: '应用不存在或已禁用' },
        { status: 400 }
      );
    }

    // 用户拒绝
    if (action === 'deny') {
      const callback = new URL(redirect_uri);
      callback.searchParams.set('error', 'access_denied');
      if (state) callback.searchParams.set('state', state);
      return NextResponse.json({ redirect: callback.toString() });
    }

    // 用户同意 → 生成授权码
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟

    await prisma.oAuthAuthorizationCode.create({
      data: {
        appId: app.id,
        userId: userPayload.userId,
        code,
        redirectUri: redirect_uri,
        scope: scope || null,
        expiresAt,
      },
    });

    const callback = new URL(redirect_uri);
    callback.searchParams.set('code', code);
    if (state) callback.searchParams.set('state', state);

    return NextResponse.json({ redirect: callback.toString() });
  } catch (error) {
    console.error('[OAUTH AUTHORIZE POST ERROR]', error);
    return NextResponse.json(
      { error: 'server_error', error_description: '授权失败' },
      { status: 500 }
    );
  }
}
