import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { isProjectMember, isProjectManager, stringifyJsonArray } from '@/lib/collab';

export const dynamic = 'force-dynamic';

// 允许的任务状态流转
const ALLOWED_TASK_STATUSES = [
  'open',
  'in_progress',
  'review',
  'completed',
  'cancelled',
];

// ============ PATCH /api/collab/projects/[id]/tasks/[taskId] - 更新任务 ============
// 可更新: title, description, status, priority, assigneeId, labels, dueDate
// - 当 status 变为 completed 时，设置 completedAt 并更新项目 completedTaskCount
// - 认领任务: 任何成员可以将 open 状态的任务 assigneeId 设为自己的 userId
// - 状态变更: open -> in_progress -> review -> completed
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } },
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

    const { id, taskId } = params;

    if (!id || !taskId) {
      return NextResponse.json(
        { error: '无效的项目 ID 或任务 ID' },
        { status: 400 },
      );
    }

    // ---- 检查任务是否存在且属于该项目 ----
    const existing = await prisma.collabTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        status: true,
        assigneeId: true,
        completedAt: true,
      },
    });

    if (!existing || existing.projectId !== id) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 },
      );
    }

    // ---- 权限检查：必须是项目成员 ----
    const isMember = await isProjectMember(id, user.userId);
    if (!isMember && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '仅项目成员可更新任务' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      status,
      priority,
      assigneeId,
      labels,
      dueDate,
    } = body;

    // ---- 输入校验 ----
    if (title !== undefined && (!title || title.length > 100)) {
      return NextResponse.json(
        { error: '任务标题不能为空且不能超过 100 个字符' },
        { status: 400 },
      );
    }

    if (status !== undefined && !ALLOWED_TASK_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: '无效的任务状态' },
        { status: 400 },
      );
    }

    const allowedPriorities = ['low', 'medium', 'high', 'urgent'];
    if (priority !== undefined && !allowedPriorities.includes(priority)) {
      return NextResponse.json(
        { error: '无效的优先级' },
        { status: 400 },
      );
    }

    // ---- 认领逻辑：普通成员只能认领 open 状态任务给自己 ----
    // 如果是修改 assigneeId 但不是 manager，必须是认领给自己且任务为 open
    const isManager =
      user.role === 'ADMIN' || (await isProjectManager(id, user.userId));

    if (assigneeId !== undefined && !isManager) {
      // 非管理者修改指派人：只允许将 open 任务指派给自己
      if (assigneeId !== user.userId) {
        return NextResponse.json(
          { error: '你只能认领任务给自己，不能指派给他人' },
          { status: 403 },
        );
      }
      if (existing.status !== 'open') {
        return NextResponse.json(
          { error: '仅 open 状态的任务可以被认领' },
          { status: 400 },
        );
      }
    }

    // 校验指派人（若提供，必须是项目活跃成员）
    if (assigneeId && assigneeId !== null) {
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

    // ---- 构建更新数据 ----
    const data: Record<string, unknown> = {};

    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description || null;
    if (priority !== undefined) data.priority = priority;
    if (assigneeId !== undefined) data.assigneeId = assigneeId || null;

    if (labels !== undefined) {
      const labelsArr = Array.isArray(labels)
        ? labels.filter((l: unknown) => typeof l === 'string')
        : [];
      data.labels = stringifyJsonArray(labelsArr);
    }

    if (dueDate !== undefined) {
      if (dueDate) {
        const parsedDate = new Date(dueDate);
        data.dueDate = isNaN(parsedDate.getTime()) ? null : parsedDate;
      } else {
        data.dueDate = null;
      }
    }

    // ---- 处理状态变更 ----
    let willComplete = false;
    if (status !== undefined && status !== existing.status) {
      data.status = status;
      if (status === 'completed') {
        willComplete = true;
        data.completedAt = new Date();
      } else if (status !== 'completed' && existing.completedAt) {
        // 从已完成状态回退，清空完成时间
        data.completedAt = null;
      }
    }

    // ---- 事务：更新任务 + 同步项目 completedTaskCount ----
    const task = await prisma.$transaction(async (tx) => {
      const updated = await tx.collabTask.update({
        where: { id: taskId },
        data,
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

      // 同步项目已完成任务数
      if (willComplete) {
        // 完成任务 +1
        await tx.collabProject.update({
          where: { id },
          data: { completedTaskCount: { increment: 1 } },
        });
      } else if (
        status !== undefined &&
        existing.status === 'completed' &&
        status !== 'completed'
      ) {
        // 从已完成回退为其他状态 -1
        await tx.collabProject.update({
          where: { id },
          data: { completedTaskCount: { decrement: 1 } },
        });
      }

      return updated;
    });

    return NextResponse.json({
      ...task,
      labels: task.labels ? JSON.parse(task.labels) : [],
    });
  } catch (error) {
    console.error('[COLLAB TASK UPDATE ERROR]', error);
    return NextResponse.json(
      { error: '更新任务失败' },
      { status: 500 },
    );
  }
}
