import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';

// 允许的举报状态
const ALLOWED_STATUSES = ['resolved', 'dismissed'];

// ============ PATCH /api/forum/reports/[id] - 更新举报状态（管理员） ============
// body: { status: 'resolved' | 'dismissed' }
export async function PATCH(
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
        { error: '无效的举报 ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;

    // ---- 输入校验 ----
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: '无效的状态，仅支持 resolved 或 dismissed' },
        { status: 400 }
      );
    }

    // 检查举报是否存在
    const existing = await prisma.report.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: '举报不存在' },
        { status: 404 }
      );
    }

    // ---- 更新举报状态 ----
    const report = await prisma.report.update({
      where: { id },
      data: { status },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: status === 'resolved' ? '举报已处理' : '举报已驳回',
      report,
    });
  } catch (error) {
    console.error('[REPORT UPDATE ERROR]', error);
    return NextResponse.json(
      { error: '更新举报状态失败' },
      { status: 500 }
    );
  }
}
