import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ============ POST /api/collab/projects/[id]/leave - 离开项目 ============
// 需要登录
// - owner 不能离开（需先转让）
// - 更新成员状态为 left，设置 leftAt
// - 更新项目 memberCount
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
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

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '无效的项目 ID' },
        { status: 400 },
      );
    }

    // ---- 检查成员记录是否存在 ----
    const member = await prisma.collabMember.findUnique({
      where: {
        projectId_userId: { projectId: id, userId: user.userId },
      },
    });

    if (!member || member.status !== 'active') {
      return NextResponse.json(
        { error: '你不在该项目成员列表中' },
        { status: 400 },
      );
    }

    // ---- owner 不能离开 ----
    if (member.role === 'owner') {
      return NextResponse.json(
        { error: '项目发起人不能直接离开，请先转让所有权给其他成员' },
        { status: 400 },
      );
    }

    // ---- 事务：更新成员状态 + 更新项目成员数 ----
    await prisma.$transaction(async (tx) => {
      await tx.collabMember.update({
        where: { id: member.id },
        data: {
          status: 'left',
          leftAt: new Date(),
        },
      });

      // 更新项目成员数（避免减为负数）
      const project = await tx.collabProject.findUnique({
        where: { id },
        select: { memberCount: true },
      });
      if (project && project.memberCount > 0) {
        await tx.collabProject.update({
          where: { id },
          data: { memberCount: { decrement: 1 } },
        });
      }
    });

    return NextResponse.json({ message: '已离开项目' });
  } catch (error) {
    console.error('[COLLAB LEAVE ERROR]', error);
    return NextResponse.json(
      { error: '离开项目失败' },
      { status: 500 },
    );
  }
}
