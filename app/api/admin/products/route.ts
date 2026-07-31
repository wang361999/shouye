import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { slugify } from '@/lib/utils';

/** GET /api/admin/products - 获取产品列表（含订单/授权码/版本数量） */
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: {
          select: { orders: true, licenses: true, versions: true },
        },
      },
    });

    const result = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      tagline: p.tagline,
      description: p.description,
      icon: p.icon,
      coverImage: p.coverImage,
      features: p.features,
      techStack: p.techStack,
      screenshots: p.screenshots,
      demoUrl: p.demoUrl,
      docsUrl: p.docsUrl,
      status: p.status,
      sortOrder: p.sortOrder,
      // 定价（单位：分）
      priceBasic: p.priceBasic,
      priceStandard: p.priceStandard,
      pricePremium: p.pricePremium,
      priceEnterprise: p.priceEnterprise,
      validDays: p.validDays,
      orderCount: p._count.orders,
      licenseCount: p._count.licenses,
      versionCount: p._count.versions,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PRODUCTS GET ERROR]', error);
    return NextResponse.json({ error: '获取产品列表失败' }, { status: 500 });
  }
}

/** POST /api/admin/products - 创建产品 */
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const {
      name, slug, tagline, description, icon, coverImage,
      features, demoUrl, docsUrl, status, sortOrder,
      priceBasic, priceStandard, pricePremium, priceEnterprise,
      validDays,
    } = body;

    if (!name) {
      return NextResponse.json({ error: '产品名称不能为空' }, { status: 400 });
    }
    if (!tagline) {
      return NextResponse.json({ error: '产品一句话描述不能为空' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: '产品详细介绍不能为空' }, { status: 400 });
    }

    // 生成 slug：优先使用传入值，否则从 name 生成
    let finalSlug = slug ? String(slug).trim() : slugify(name);
    if (!finalSlug) {
      return NextResponse.json({ error: '无法生成有效的 slug' }, { status: 400 });
    }

    // 校验 slug 唯一
    const existing = await prisma.product.findUnique({ where: { slug: finalSlug } });
    if (existing) {
      return NextResponse.json({ error: `slug "${finalSlug}" 已存在，请更换` }, { status: 400 });
    }

    // 规范化 features：接受 JSON 字符串或数组
    let featuresValue: string | null = null;
    if (features !== undefined && features !== null && features !== '') {
      featuresValue = Array.isArray(features) ? JSON.stringify(features) : String(features);
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug: finalSlug,
        tagline,
        description,
        icon: icon || null,
        coverImage: coverImage || null,
        features: featuresValue,
        demoUrl: demoUrl || null,
        docsUrl: docsUrl || null,
        status: status || 'active',
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
        priceBasic: typeof priceBasic === 'number' ? priceBasic : 0,
        priceStandard: typeof priceStandard === 'number' ? priceStandard : 0,
        pricePremium: typeof pricePremium === 'number' ? pricePremium : 0,
        priceEnterprise: typeof priceEnterprise === 'number' ? priceEnterprise : 0,
        validDays: typeof validDays === 'number' ? validDays : 365,
      },
    });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'create_product',
        target: 'Product',
        detail: `创建产品: ${product.name} (${product.slug})`,
      },
    });

    return NextResponse.json({
      id: product.id,
      name: product.name,
      slug: product.slug,
      message: '产品创建成功',
    }, { status: 201 });
  } catch (error) {
    console.error('[PRODUCTS POST ERROR]', error);
    return NextResponse.json({ error: '创建产品失败' }, { status: 500 });
  }
}

/** PATCH /api/admin/products - 更新产品 */
export async function PATCH(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const {
      id, name, slug, tagline, description, icon, coverImage,
      features, demoUrl, docsUrl, status, sortOrder,
      priceBasic, priceStandard, pricePremium, priceEnterprise,
      validDays,
    } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少产品 ID' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    }

    // slug 唯一性校验（若变更）
    if (slug !== undefined) {
      const finalSlug = slug ? String(slug).trim() : product.slug;
      if (finalSlug !== product.slug) {
        const conflict = await prisma.product.findUnique({ where: { slug: finalSlug } });
        if (conflict && conflict.id !== id) {
          return NextResponse.json({ error: `slug "${finalSlug}" 已存在，请更换` }, { status: 400 });
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) {
      updateData.slug = slug ? String(slug).trim() : product.slug;
    }
    if (tagline !== undefined) updateData.tagline = tagline;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon || null;
    if (coverImage !== undefined) updateData.coverImage = coverImage || null;
    if (features !== undefined) {
      updateData.features =
        features === null || features === ''
          ? null
          : Array.isArray(features)
            ? JSON.stringify(features)
            : String(features);
    }
    if (demoUrl !== undefined) updateData.demoUrl = demoUrl || null;
    if (docsUrl !== undefined) updateData.docsUrl = docsUrl || null;
    if (status !== undefined) updateData.status = status;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (priceBasic !== undefined) updateData.priceBasic = priceBasic;
    if (priceStandard !== undefined) updateData.priceStandard = priceStandard;
    if (pricePremium !== undefined) updateData.pricePremium = pricePremium;
    if (priceEnterprise !== undefined) updateData.priceEnterprise = priceEnterprise;
    if (validDays !== undefined) updateData.validDays = validDays;

    await prisma.product.update({ where: { id }, data: updateData });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'update_product',
        target: 'Product',
        detail: `更新产品: ${product.name} (${product.slug}) - ${JSON.stringify(updateData)}`,
      },
    });

    return NextResponse.json({ message: '产品已更新' });
  } catch (error) {
    console.error('[PRODUCTS PATCH ERROR]', error);
    return NextResponse.json({ error: '更新产品失败' }, { status: 500 });
  }
}

/** DELETE /api/admin/products - 删除产品 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少产品 ID' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    }

    // 删除产品：版本将级联删除；关联订单级联删除；授权码 productId 置空（由 schema onDelete 处理）
    await prisma.product.delete({ where: { id } });

    await prisma.operationLog.create({
      data: {
        userId: admin.userId,
        username: admin.username,
        action: 'delete_product',
        target: 'Product',
        detail: `删除产品: ${product.name} (${product.slug})`,
      },
    });

    return NextResponse.json({ message: '产品已删除' });
  } catch (error) {
    console.error('[PRODUCTS DELETE ERROR]', error);
    return NextResponse.json({ error: '删除产品失败' }, { status: 500 });
  }
}
