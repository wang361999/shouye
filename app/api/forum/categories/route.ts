import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

// 缓存 GET 响应 1 小时（分类数据不频繁变化）
// POST/PUT/DELETE 仍为动态请求，不受影响
export const revalidate = 3600;

// ============ GET /api/forum/categories - 获取分类列表 ============
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { posts: { where: { status: 'PUBLISHED' } } },
        },
      },
    });

    // 转换 _count 为 postCount 字段
    const categoriesWithCount = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      desc: cat.desc,
      sortOrder: cat.sortOrder,
      postCount: cat._count.posts,
    }));

    return NextResponse.json(categoriesWithCount);
  } catch (error) {
    console.error('[CATEGORIES LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取分类列表失败' },
      { status: 500 }
    );
  }
}

// ============ POST /api/forum/categories - 新增分类（管理员） ============
export async function POST(request: NextRequest) {
  try {
    // 管理员鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { name, slug, icon, desc, sortOrder } = body;

    // ---- 输入校验 ----
    if (!name || !slug) {
      return NextResponse.json(
        { error: '分类名称和 slug 不能为空' },
        { status: 400 }
      );
    }

    // 检查 slug 是否已存在
    const existing = await prisma.category.findUnique({
      where: { slug },
    });
    if (existing) {
      return NextResponse.json(
        { error: '该 slug 已被使用' },
        { status: 409 }
      );
    }

    // ---- 创建分类 ----
    const category = await prisma.category.create({
      data: {
        name,
        slug,
        icon: icon || null,
        desc: desc || null,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      },
    });

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
    // 管理员鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { id, name, slug, icon, desc, sortOrder } = body;

    // ---- 输入校验 ----
    if (!id) {
      return NextResponse.json(
        { error: '缺少分类 ID' },
        { status: 400 }
      );
    }

    // 检查分类是否存在
    const existing = await prisma.category.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: '分类不存在' },
        { status: 404 }
      );
    }

    // 如果修改了 slug，检查唯一性
    if (slug && slug !== existing.slug) {
      const slugUsed = await prisma.category.findUnique({
        where: { slug },
      });
      if (slugUsed) {
        return NextResponse.json(
          { error: '该 slug 已被使用' },
          { status: 409 }
        );
      }
    }

    // ---- 更新分类 ----
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
    // 管理员鉴权
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

    // 检查分类是否存在
    const existing = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '分类不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联帖子
    if (existing._count.posts > 0) {
      return NextResponse.json(
        { error: '该分类下还有帖子，无法删除。请先移除或删除该分类下的所有帖子' },
        { status: 400 }
      );
    }

    // ---- 删除分类 ----
    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json({ message: '分类已删除' });
  } catch (error) {
    console.error('[CATEGORY DELETE ERROR]', error);
    return NextResponse.json(
      { error: '删除分类失败' },
      { status: 500 }
    );
  }
}
