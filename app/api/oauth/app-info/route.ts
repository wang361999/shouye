import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/oauth/app-info?client_id=xxx
 *
 * 公开接口，返回 OAuth 应用的基本信息（用于授权同意页展示）
 * 不返回 client_secret
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');

    if (!clientId) {
      return NextResponse.json(
        { error: '缺少 client_id 参数' },
        { status: 400 }
      );
    }

    const app = await prisma.oAuthApp.findUnique({
      where: { clientId },
      select: {
        name: true,
        description: true,
        homepage: true,
        logo: true,
        status: true,
      },
    });

    if (!app) {
      return NextResponse.json(
        { error: '应用不存在' },
        { status: 404 }
      );
    }

    if (app.status !== 'active') {
      return NextResponse.json(
        { error: '应用已被禁用' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      name: app.name,
      description: app.description,
      homepage: app.homepage,
      logo: app.logo,
    });
  } catch (error) {
    console.error('[OAUTH APP-INFO ERROR]', error);
    return NextResponse.json(
      { error: '获取应用信息失败' },
      { status: 500 }
    );
  }
}
