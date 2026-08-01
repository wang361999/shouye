import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { isProjectManager } from '@/lib/collab';

export const dynamic = 'force-dynamic';

// 允许的审核状态
const ALLOWED_REVIEW_STATUSES = ['approved', 'rejected'];

// ============ PATCH /api/collab/projects/[id]/contributions/[contribId] - 审核贡献 ============
// 仅 owner / maintainer 可操作
// body: status(approved/rejected)
// 审核通过后，贡献状态变为 approved
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; contribId: string } },
) {
  try {
    // ---- 登录鉴权 ----
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 },
      );
    }

    const { id, contribId } = params;

    if (!id || !contribId) {
      return NextResponse.json(
        { error: '无效的项目 ID 或贡献 ID' },
        { status: 400 },
      );
    }

    // ---- 检查贡献记录是否存在且属于该项目 ----
    const existing = await prisma.collabContribution.findUnique({
      where: { id: contribId },
      select: { id: true, projectId: true, status: true },
    });

    if (!existing || existing.projectId !== id) {
      return NextResponse.json(
        { error: '贡献记录不存在' },
        { status: 404 },
      );
    }

    // ---- 权限检查：owner / maintainer（或管理员） ----
    const isManager =
      user.role === 'ADMIN' || (await isProjectManager(id, user.userId));

    if (!isManager) {
      return NextResponse.json(
        { error: '无权审核贡献，仅 owner 或 maintainer 可操作' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { status } = body;

    // ---- 输入校验 ----
    if (!status || !ALLOWED_REVIEW_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: '审核状态无效，可选值: approved / rejected' },
        { status: 400 },
      );
    }

    // ---- 更新贡献状态 ----
    const contribution = await prisma.collabContribution.update({
      where: { id: contribId },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            githubLogin: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json(contribution);
  } catch (error) {
    console.error('[COLLAB CONTRIBUTION REVIEW ERROR]', error);
    return NextResponse.json(
      { error: '审核贡献失败' },
      { status: 500 },
    );
  }
}
