import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

/**
 * POST /api/admin/products/update-download-url
 * 批量更新所有产品的 downloadUrl 为 GitHub 仓库地址
 * Body: { url?: string } - 可选自定义 URL，默认使用 https://github.com/wang361999/gengxin
 */
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json().catch(() => ({}));
    const url = body.url || 'https://github.com/wang361999/gengxin';

    // 更新所有 active 产品的 downloadUrl
    const result = await prisma.product.updateMany({
      where: { status: 'active' },
      data: { downloadUrl: url },
    });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'update_download_url',
        target: 'Product',
        detail: `批量更新 ${result.count} 个产品的下载链接为 ${url}`,
      },
    });

    return NextResponse.json({
      message: `已更新 ${result.count} 个产品的下载链接`,
      updated: result.count,
      url,
    });
  } catch (error) {
    console.error('[UPDATE DOWNLOAD URL ERROR]', error);
    return NextResponse.json(
      { error: '更新下载链接失败' },
      { status: 500 },
    );
  }
}
