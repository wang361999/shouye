import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDb, queryWithTimeout } from '@/lib/db';
import { checkDbOr503 } from '@/lib/db-check';
import { adminAuth } from '@/lib/auth';
import { getCategoryDisplayName } from '@/lib/utils';

// 分类数据需要即时可见（创建后立即显示），禁用 ISR 缓存
export const dynamic = 'force-dynamic';

// 模块级缓存（60 秒 TTL）—— 分类变更频率低，减少数据库查询
let cachedCategories: unknown[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000;

// ============ GET /api/forum/categories - 获取分类列表 ============
export async function GET() {
  const now = Date.now();
  if (cachedCategories && now < cacheExpiry) {
    return NextResponse.json(cachedCategories, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  }

  let db;
  const dbError = checkDbOr503();
  if (dbError) return dbError;
  try {
    db = getDb();
  } catch {
    return NextResponse.json([]);
  }

  try {
    const rows = await queryWithTimeout(
      db,
      `SELECT c.id, c.name, c.slug, c.icon, c.desc, c.sort_order,
              COUNT(p.id) as post_count
       FROM Category c
       LEFT JOIN Post p ON c.id = p.category_id AND p.status = 'PUBLISHED'
       GROUP BY c.id
       ORDER BY c.sort_order ASC`,
      [],
      5000,
    );

    const result = (rows as Record<string, unknown>[]).map((cat) => ({
      id: cat.id,
      name: getCategoryDisplayName(cat.name as string, cat.slug as string),
      slug: cat.slug,
      icon: cat.icon,
      desc: cat.desc,
      sortOrder: Number(cat.sort_order) || 0,
      postCount: Number(cat.post_count) || 0,
    }));

    cachedCategories = result;
    cacheExpiry = now + CACHE_TTL;

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (err) {
    // 查询失败时返回缓存数据（如果有）
    if (cachedCategories) {
      return NextResponse.json(cachedCategories, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }
    console.error('[CATEGORIES GET ERROR]', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: '获取分类失败', hint: '数据库查询超时，请稍后重试' },
      { status: 503 }
    );
  }
}

// ============ POST /api/forum/categories - 新增分类（管理员） ============
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { name, slug, icon, desc, sortOrder } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: '分类名称和 slug 不能为空' },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: '该 slug 已被使用' },
        { status: 409 }
      );
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        icon: icon || null,
        desc: desc || null,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      },
    });

    // 清除缓存
    cachedCategories = null;

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('[CATEGORY CREATE ERROR]', error);
    return NextResponse.json(
      { error: '创建分类失败' },
      { status: 500 }
    );
  }
}

// ============ PUT /api/forum/categories - 更新分类（管理员） ============
export async function PUT(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { id, name, slug, icon, desc, sortOrder } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少分类 ID' },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: '分类不存在' },
        { status: 404 }
      );
    }

    if (slug && slug !== existing.slug) {
      const slugUsed = await prisma.category.findUnique({ where: { slug } });
      if (slugUsed) {
        return NextResponse.json(
          { error: '该 slug 已被使用' },
          { status: 409 }
        );
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(icon !== undefined && { icon: icon || null }),
        ...(desc !== undefined && { desc: desc || null }),
        ...(sortOrder !== undefined && {
          sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
        }),
      },
    });

    // 清除缓存
    cachedCategories = null;

    return NextResponse.json(category);
  } catch (error) {
    console.error('[CATEGORY UPDATE ERROR]', error);
    return NextResponse.json(
      { error: '更新分类失败' },
      { status: 500 }
    );
  }
}

// ============ DELETE /api/forum/categories - 删除分类（管理员） ============
export async function DELETE(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '缺少分类 ID' },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '分类不存在' },
        { status: 404 }
      );
    }

    if (existing._count.posts > 0) {
      return NextResponse.json(
        { error: '该分类下还有帖子，无法删除。请先移除或删除该分类下的所有帖子' },
        { status: 400 }
      );
    }

    await prisma.category.delete({ where: { id } });

    // 清除缓存
    cachedCategories = null;

    return NextResponse.json({ message: '分类已删除' });
  } catch (error) {
    console.error('[CATEGORY DELETE ERROR]', error);
    return NextResponse.json(
      { error: '删除分类失败' },
      { status: 500 }
    );
  }
}
