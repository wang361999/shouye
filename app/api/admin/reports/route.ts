import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

// ============ GET /api/admin/reports - 管理员举报列表 ============
// 仅管理员可访问。支持 ?status= 筛选（pending|resolved|dismissed）和分页。
// include reporter 信息。
// 返回: { reports: [...], total, page, totalPages }
export async function GET(request: NextRequest) {
  try {
    // 管理员鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const status = searchParams.get('status') || undefined;
    const targetType = searchParams.get('targetType') || undefined;

    // 构建查询条件
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    if (targetType) {
      where.targetType = targetType;
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.report.count({ where }),
    ]);

    return NextResponse.json({
      reports,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[ADMIN REPORTS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取举报列表失败' },
      { status: 500 },
    );
  }
}
