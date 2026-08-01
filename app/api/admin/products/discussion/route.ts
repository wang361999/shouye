import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

/**
 * POST /api/admin/products/discussion
 * 为产品创建讨论区分类（如果不存在）
 * Body: { productId }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json({ error: '缺少产品 ID' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, slug: true },
    });

    if (!product) {
      return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    }

    // 检查是否已有讨论区
    const existing = await prisma.category.findFirst({
      where: { productId },
    });

    if (existing) {
      return NextResponse.json({
        message: '讨论区已存在',
        category: existing,
      });
    }

    // 创建讨论区分类
    const slug = `project-${product.slug}`;
    const category = await prisma.category.create({
      data: {
        name: `${product.name} 讨论区`,
        slug,
        icon: '📦',
        desc: `${product.name} 项目讨论区，欢迎提问和分享经验`,
        productId,
        sortOrder: 100,
      },
    });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'create_discussion_category',
        target: 'Category',
        detail: `为产品 ${product.name} 创建讨论区: ${category.name}`,
      },
    });

    return NextResponse.json(
      { message: '讨论区创建成功', category },
      { status: 201 },
    );
  } catch (error) {
    console.error('[DISCUSSION CREATE ERROR]', error);
    return NextResponse.json({ error: '创建讨论区失败' }, { status: 500 });
  }
}
