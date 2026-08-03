import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { isProjectMember, stringifyJsonArray } from '@/lib/collab';

export const dynamic = 'force-dynamic';

// ============ GET /api/collab/projects/[id]/tasks - 获取任务列表 ============
// 查询参数: status, assigneeId
// 返回任务列表（含指派人信息）
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '无效的项目 ID' },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const assigneeId = searchParams.get('assigneeId') || undefined;

    // ---- 构建查询条件 ----
    const where: Prisma.CollabTaskWhereInput = { projectId: id };

    if (status) {
      where.status = status;
    }

    if (assigneeId) {
      where.assigneeId = assigneeId;
    }

    const tasks = await prisma.collabTask.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        assignee: {
          select: {
            id: true,
            username: true,
            avatar: true,
            githubLogin: true,
          },
        },
        _count: {
          select: { contributions: true },
        },
      },
    });

    // ---- 序列化 labels 字段 ----
    const data = tasks.map((task) => ({
      ...task,
      labels: task.labels ? JSON.parse(task.labels) : [],
      contributionCount: task._count.contributions,
      _count: undefined,
    }));

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    console.error('[COLLAB TASKS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取任务列表失败' },
      { status: 500 },
    );
  }
}

// ============ POST /api/collab/projects/[id]/tasks - 创建任务 ============
// 需要登录，仅 owner/maintainer/member 可创建
// body: title, description, priority, labels, dueDate, assigneeId
// 更新项目 taskCount
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

    // ---- 检查项目是否存在 ----
    const project = await prisma.collabProject.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 },
      );
    }

    // ---- 权限检查：项目成员才可创建任务 ----
    const isMember = await isProjectMember(id, user.userId);
    if (!isMember && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '仅项目成员可创建任务' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { title, description, priority, labels, dueDate, assigneeId } = body;

    // ---- 输入校验 ----
    if (!title) {
      return NextResponse.json(
        { error: '任务标题不能为空' },
        { status: 400 },
      );
    }

    if (title.length > 100) {
      return NextResponse.json(
        { error: '任务标题不能超过 100 个字符' },
        { status: 400 },
      );
    }

    const allowedPriorities = ['low', 'medium', 'high', 'urgent'];
    const priorityValue = allowedPriorities.includes(priority)
      ? priority
      : 'medium';

    // 校验标签为数组
    const labelsArr = Array.isArray(labels)
      ? labels.filter((l: unknown) => typeof l === 'string')
      : [];

    // 解析截止日期
    let dueDateValue: Date | null = null;
    if (dueDate) {
      const parsedDate = new Date(dueDate);
      if (!isNaN(parsedDate.getTime())) {
        dueDateValue = parsedDate;
      }
    }

    // 校验指派人（若提供，必须是项目活跃成员）
    if (assigneeId) {
      const assigneeMember = await prisma.collabMember.findUnique({
        where: {
          projectId_userId: { projectId: id, userId: assigneeId },
        },
        select: { status: true },
      });
      if (!assigneeMember || assigneeMember.status !== 'active') {
        return NextResponse.json(
          { error: '指派人不是该项目的活跃成员' },
          { status: 400 },
        );
      }
    }

    // ---- 事务：创建任务 + 更新项目 taskCount ----
    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.collabTask.create({
        data: {
          projectId: id,
          title,
          description: description || null,
          assigneeId: assigneeId || null,
          status: 'open',
          priority: priorityValue,
          labels: stringifyJsonArray(labelsArr),
          dueDate: dueDateValue,
        },
        include: {
          assignee: {
            select: {
              id: true,
              username: true,
              avatar: true,
              githubLogin: true,
            },
          },
        },
      });

      await tx.collabProject.update({
        where: { id },
        data: { taskCount: { increment: 1 } },
      });

      return created;
    });

    return NextResponse.json(
      {
        ...task,
        labels: labelsArr,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[COLLAB TASK CREATE ERROR]', error);
    return NextResponse.json(
      { error: '创建任务失败' },
      { status: 500 },
    );
  }
}
