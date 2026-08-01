import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ============ POST /api/collab/projects/[id]/join - 加入项目 ============
// 需要登录
// - 检查项目状态是否为 recruiting 或 active
// - 检查是否已达最大成员数
// - 检查是否已是成员
// - 如果用户有 githubLogin，写入成员记录
// - 更新项目的 memberCount
// - 返回成员信息
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

    // ---- 检查项目是否存在及状态 ----
    const project = await prisma.collabProject.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        maxMembers: true,
        memberCount: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 },
      );
    }

    if (!['recruiting', 'active'].includes(project.status)) {
      return NextResponse.json(
        { error: '当前项目不在招募状态，无法加入' },
        { status: 400 },
      );
    }

    // ---- 检查是否已是成员（含已离开的记录） ----
    const existingMember = await prisma.collabMember.findUnique({
      where: {
        projectId_userId: { projectId: id, userId: user.userId },
      },
    });

    if (existingMember && existingMember.status === 'active') {
      return NextResponse.json(
        { error: '你已经是该项目成员' },
        { status: 400 },
      );
    }

    // ---- 检查是否已达最大成员数（仅统计活跃成员） ----
    const activeCount = await prisma.collabMember.count({
      where: { projectId: id, status: 'active' },
    });

    if (activeCount >= project.maxMembers) {
      return NextResponse.json(
        { error: `项目成员已达上限（${project.maxMembers} 人），无法加入` },
        { status: 400 },
      );
    }

    // ---- 查询用户的 GitHub 登录名 ----
    const userInfo = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { githubLogin: true },
    });

    // ---- 事务：创建/恢复成员记录 + 更新项目成员数 ----
    const member = await prisma.$transaction(async (tx) => {
      let record;
      if (existingMember) {
        // 之前离开过，恢复为活跃成员
        record = await tx.collabMember.update({
          where: { id: existingMember.id },
          data: {
            status: 'active',
            role: 'member',
            githubLogin: userInfo?.githubLogin || null,
            leftAt: null,
            joinedAt: new Date(),
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                githubLogin: true,
              },
            },
          },
        });
      } else {
        // 新成员
        record = await tx.collabMember.create({
          data: {
            projectId: id,
            userId: user.userId,
            role: 'member',
            status: 'active',
            githubLogin: userInfo?.githubLogin || null,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                githubLogin: true,
              },
            },
          },
        });
      }

      // 更新项目成员数
      await tx.collabProject.update({
        where: { id },
        data: { memberCount: { increment: 1 } },
      });

      return record;
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('[COLLAB JOIN ERROR]', error);
    return NextResponse.json(
      { error: '加入项目失败' },
      { status: 500 },
    );
  }
}
