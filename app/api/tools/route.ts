import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// ============ GET /api/tools - 获取工具列表 ============
// 管理员（带 Authorization header）可获取全部工具（含已下线）
// 普通请求仅返回已上线工具
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    const isActiveParam = searchParams.get('isActive'); // "true" | "false"

    // 判断是否为管理员请求
    const admin = adminAuth(request);
    const isAdmin = !!admin && !(admin instanceof Response);

    const where: Prisma.ToolWhereInput = {};

    // 非管理员只能看到已上线工具
    if (!isAdmin) {
      where.isActive = true;
    } else if (isActiveParam === 'true' || isActiveParam === 'false') {
      where.isActive = isActiveParam === 'true';
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const tools = await prisma.tool.findMany({
      where,
      orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(tools);
  } catch (error) {
    console.error('[TOOLS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取工具列表失败' },
      { status: 500 }
    );
  }
}

// ============ POST /api/tools - 新增工具（管理员） ============
export async function POST(request: NextRequest) {
  try {
    // 管理员鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const {
      name,
      description,
      url,
      icon,
      category,
      isActive,
      isFeatured,
      needLogin,
      coverImage,
      sortOrder,
    } = body;

    // ---- 输入校验 ----
    if (!name || !description || !url) {
      return NextResponse.json(
        { error: '工具名称、描述和链接不能为空' },
        { status: 400 }
      );
    }

    // ---- 创建工具 ----
    const tool = await prisma.tool.create({
      data: {
        name,
        description,
        url,
        icon: icon || null,
        category: category || null,
        isActive: isActive !== undefined ? !!isActive : true,
        isFeatured: !!isFeatured,
        needLogin: !!needLogin,
        coverImage: coverImage || null,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      },
    });

    return NextResponse.json(tool, { status: 201 });
  } catch (error) {
    console.error('[TOOL CREATE ERROR]', error);
    return NextResponse.json(
      { error: '创建工具失败' },
      { status: 500 }
    );
  }
}
