import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { logOperation } from '@/lib/admin-log';

/** GET /api/admin/oauth-apps - 获取所有 OAuth 应用 */
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const apps = await prisma.oAuthApp.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            accessTokens: true,
            authCodes: true,
          },
        },
      },
    });

    // 不返回 clientSecret 明文，只返回是否已设置
    const result = apps.map((app) => ({
      id: app.id,
      name: app.name,
      clientId: app.clientId,
      clientSecretSet: !!app.clientSecret,
      redirectUris: JSON.parse(app.redirectUris),
      description: app.description,
      homepage: app.homepage,
      logo: app.logo,
      status: app.status,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      tokenCount: app._count.accessTokens,
      authCodeCount: app._count.authCodes,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[OAUTH APPS GET ERROR]', error);
    return NextResponse.json({ error: '获取 OAuth 应用列表失败' }, { status: 500 });
  }
}

/** POST /api/admin/oauth-apps - 创建 OAuth 应用 */
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { name, redirectUris, description, homepage, logo } = body;

    if (!name || !redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
      return NextResponse.json(
        { error: '应用名称和回调地址不能为空' },
        { status: 400 }
      );
    }

    // 验证 redirect_uri 格式
    for (const uri of redirectUris) {
      try {
        new URL(uri);
      } catch {
        return NextResponse.json(
          { error: `回调地址格式无效: ${uri}` },
          { status: 400 }
        );
      }
    }

    const clientId = crypto.randomBytes(16).toString('hex');
    const clientSecret = crypto.randomBytes(32).toString('hex');

    const app = await prisma.oAuthApp.create({
      data: {
        name,
        clientId,
        clientSecret,
        redirectUris: JSON.stringify(redirectUris),
        description: description || null,
        homepage: homepage || null,
        logo: logo || null,
      },
    });

    // 记录操作日志
    await logOperation(
      admin.userId,
      admin.username,
      'create_oauth_app',
      'OAuthApp',
      `创建 OAuth 应用: ${name}`,
    );

    // 创建时返回 clientSecret（仅此一次）
    return NextResponse.json({
      id: app.id,
      name: app.name,
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      redirectUris,
      description: app.description,
      homepage: app.homepage,
      logo: app.logo,
      status: app.status,
      message: '应用创建成功，请妥善保存 Client Secret（仅显示一次）',
    }, { status: 201 });
  } catch (error) {
    console.error('[OAUTH APPS POST ERROR]', error);
    return NextResponse.json({ error: '创建 OAuth 应用失败' }, { status: 500 });
  }
}

/** DELETE /api/admin/oauth-apps - 删除 OAuth 应用 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少应用 ID' }, { status: 400 });
    }

    const app = await prisma.oAuthApp.findUnique({ where: { id } });
    if (!app) {
      return NextResponse.json({ error: '应用不存在' }, { status: 404 });
    }

    await prisma.oAuthApp.delete({ where: { id } });

    // 记录操作日志
    await logOperation(
      admin.userId,
      admin.username,
      'delete_oauth_app',
      'OAuthApp',
      `删除 OAuth 应用: ${app.name}`,
    );

    return NextResponse.json({ message: '应用已删除' });
  } catch (error) {
    console.error('[OAUTH APPS DELETE ERROR]', error);
    return NextResponse.json({ error: '删除 OAuth 应用失败' }, { status: 500 });
  }
}

/** PATCH /api/admin/oauth-apps - 更新 OAuth 应用状态 */
export async function PATCH(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { id, status, redirectUris, description, homepage, logo, name } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少应用 ID' }, { status: 400 });
    }

    const app = await prisma.oAuthApp.findUnique({ where: { id } });
    if (!app) {
      return NextResponse.json({ error: '应用不存在' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (homepage !== undefined) updateData.homepage = homepage;
    if (logo !== undefined) updateData.logo = logo;
    if (redirectUris !== undefined && Array.isArray(redirectUris)) {
      updateData.redirectUris = JSON.stringify(redirectUris);
    }

    await prisma.oAuthApp.update({
      where: { id },
      data: updateData,
    });

    // 记录操作日志
    await logOperation(
      admin.userId,
      admin.username,
      'update_oauth_app',
      'OAuthApp',
      `更新 OAuth 应用: ${app.name}`,
    );

    return NextResponse.json({ message: '应用已更新' });
  } catch (error) {
    console.error('[OAUTH APPS PATCH ERROR]', error);
    return NextResponse.json({ error: '更新 OAuth 应用失败' }, { status: 500 });
  }
}
