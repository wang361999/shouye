import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

// ============ 操作日志记录函数 ============
async function logOperation(
  userId: string,
  username: string,
  action: string,
  target?: string,
  detail?: string,
) {
  await prisma.operationLog.create({
    data: { userId, username, action, target, detail },
  });
}

// ============ GET /api/tools/[id] - 获取单个工具详情 ============
// 管理员（带 Authorization header）可获取任意工具（含已下线）
// 普通请求仅返回已上线工具
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '无效的工具 ID' },
        { status: 400 }
      );
    }

    // 判断是否为管理员请求
    const admin = adminAuth(request);
    const isAdmin = !!admin && !(admin instanceof Response);

    const tool = isAdmin
      ? await prisma.tool.findUnique({ where: { id } })
      : await prisma.tool.findFirst({ where: { id, isActive: true } });

    if (!tool) {
      return NextResponse.json(
        { error: '工具不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json(tool);
  } catch (error) {
    console.error('[TOOL GET ERROR]', error);
    return NextResponse.json(
      { error: '获取工具详情失败' },
      { status: 500 }
    );
  }
}

// ============ PUT /api/tools/[id] - 更新工具（管理员） ============
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 管理员鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '无效的工具 ID' },
        { status: 400 }
      );
    }

    // 检查工具是否存在
    const existing = await prisma.tool.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: '工具不存在' },
        { status: 404 }
      );
    }

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

    // ---- 更新工具 ----
    const tool = await prisma.tool.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(url !== undefined && { url }),
        ...(icon !== undefined && { icon: icon || null }),
        ...(category !== undefined && { category: category || null }),
        ...(isActive !== undefined && { isActive: !!isActive }),
        ...(isFeatured !== undefined && { isFeatured: !!isFeatured }),
        ...(needLogin !== undefined && { needLogin: !!needLogin }),
        ...(coverImage !== undefined && { coverImage: coverImage || null }),
        ...(sortOrder !== undefined && {
          sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
        }),
      },
    });

    return NextResponse.json(tool);
  } catch (error) {
    console.error('[TOOL UPDATE ERROR]', error);
    return NextResponse.json(
      { error: '更新工具失败' },
      { status: 500 }
    );
  }
}

// ============ DELETE /api/tools/[id] - 删除工具（管理员） ============
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 管理员鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '无效的工具 ID' },
        { status: 400 }
      );
    }

    // 检查工具是否存在
    const existing = await prisma.tool.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: '工具不存在' },
        { status: 404 }
      );
    }

    // 硬删除（从数据库中物理删除）
    await prisma.tool.delete({ where: { id } });

    // 记录操作日志
    await logOperation(
      admin.userId,
      admin.username,
      'delete_tool',
      `Tool:${id}`,
      `删除工具：${existing.name}`,
    );

    return NextResponse.json({ message: '工具已删除' });
  } catch (error) {
    console.error('[TOOL DELETE ERROR]', error);
    return NextResponse.json(
      { error: '删除工具失败' },
      { status: 500 }
    );
  }
}
