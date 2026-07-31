import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

/** GET /api/admin/products/versions - 获取产品版本列表 (?productId=xxx) */
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: '缺少产品 ID' }, { status: 400 });
    }

    const versions = await prisma.productVersion.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });

    const result = versions.map((v) => ({
      id: v.id,
      productId: v.productId,
      version: v.version,
      title: v.title,
      changelog: v.changelog,
      downloadUrl: v.downloadUrl,
      downloadPassword: v.downloadPassword,
      fileSize: v.fileSize,
      isLatest: v.isLatest,
      isPublished: v.isPublished,
      createdAt: v.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[VERSIONS GET ERROR]', error);
    return NextResponse.json({ error: '获取版本列表失败' }, { status: 500 });
  }
}

/** POST /api/admin/products/versions - 创建版本 */
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const {
      productId, version, title, changelog,
      downloadUrl, downloadPassword, fileSize,
      isPublished, isLatest,
    } = body;

    if (!productId) {
      return NextResponse.json({ error: '缺少产品 ID' }, { status: 400 });
    }
    if (!version) {
      return NextResponse.json({ error: '版本号不能为空' }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: '版本标题不能为空' }, { status: 400 });
    }
    if (!changelog) {
      return NextResponse.json({ error: '更新日志不能为空' }, { status: 400 });
    }
    if (!downloadUrl) {
      return NextResponse.json({ error: '下载链接不能为空' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    }

    const wantLatest = isLatest === true;

    // 若设为最新版本，先把该产品其他版本的 isLatest 置为 false
    const created = await prisma.$transaction(async (tx) => {
      if (wantLatest) {
        await tx.productVersion.updateMany({
          where: { productId, isLatest: true },
          data: { isLatest: false },
        });
      }

      return tx.productVersion.create({
        data: {
          productId,
          version,
          title,
          changelog,
          downloadUrl,
          downloadPassword: downloadPassword || null,
          fileSize: fileSize || null,
          isPublished: isPublished !== undefined ? !!isPublished : true,
          isLatest: wantLatest,
        },
      });
    });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'create_version',
        target: 'ProductVersion',
        detail: `创建版本: ${product.name} ${version}${wantLatest ? ' (设为最新)' : ''}`,
      },
    });

    return NextResponse.json({
      id: created.id,
      productId: created.productId,
      version: created.version,
      isLatest: created.isLatest,
      isPublished: created.isPublished,
      message: '版本创建成功',
    }, { status: 201 });
  } catch (error) {
    console.error('[VERSIONS POST ERROR]', error);
    return NextResponse.json({ error: '创建版本失败' }, { status: 500 });
  }
}

/** PATCH /api/admin/products/versions - 更新版本 */
export async function PATCH(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const {
      id, version, title, changelog,
      downloadUrl, downloadPassword, fileSize,
      isPublished, isLatest,
    } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少版本 ID' }, { status: 400 });
    }

    const existing = await prisma.productVersion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (version !== undefined) updateData.version = version;
    if (title !== undefined) updateData.title = title;
    if (changelog !== undefined) updateData.changelog = changelog;
    if (downloadUrl !== undefined) updateData.downloadUrl = downloadUrl;
    if (downloadPassword !== undefined) updateData.downloadPassword = downloadPassword || null;
    if (fileSize !== undefined) updateData.fileSize = fileSize || null;
    if (isPublished !== undefined) updateData.isPublished = !!isPublished;
    if (isLatest !== undefined) updateData.isLatest = !!isLatest;

    // 若设为最新版本，先把该产品其他版本的 isLatest 置为 false
    if (isLatest === true) {
      await prisma.productVersion.updateMany({
        where: { productId: existing.productId, isLatest: true, NOT: { id } },
        data: { isLatest: false },
      });
    }

    await prisma.productVersion.update({ where: { id }, data: updateData });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'update_version',
        target: 'ProductVersion',
        detail: `更新版本 ${existing.version}: ${JSON.stringify(updateData)}`,
      },
    });

    return NextResponse.json({ message: '版本已更新' });
  } catch (error) {
    console.error('[VERSIONS PATCH ERROR]', error);
    return NextResponse.json({ error: '更新版本失败' }, { status: 500 });
  }
}

/** DELETE /api/admin/products/versions - 删除版本 (?id=) */
export async function DELETE(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少版本 ID' }, { status: 400 });
    }

    const existing = await prisma.productVersion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 });
    }

    await prisma.productVersion.delete({ where: { id } });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'delete_version',
        target: 'ProductVersion',
        detail: `删除版本 ${existing.version}`,
      },
    });

    return NextResponse.json({ message: '版本已删除' });
  } catch (error) {
    console.error('[VERSIONS DELETE ERROR]', error);
    return NextResponse.json({ error: '删除版本失败' }, { status: 500 });
  }
}
