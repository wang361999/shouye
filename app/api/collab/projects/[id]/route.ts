import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import {
  fetchGithubRepoInfo,
  fetchGithubCommits,
  fetchGithubContributors,
  isProjectManager,
  stringifyJsonArray,
} from '@/lib/collab';

export const dynamic = 'force-dynamic';

// ============ GET /api/collab/projects/[id] - 获取项目详情 ============
// 包含: 项目信息、作者信息、成员列表（含用户信息）、任务统计、贡献统计
// 同时通过 GitHub API 获取仓库最近5条提交和贡献者统计
// 增加浏览量 viewCount
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

    const project = await prisma.collabProject.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
            githubLogin: true,
            bio: true,
          },
        },
        members: {
          where: { status: 'active' },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                githubLogin: true,
                bio: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 },
      );
    }

    // ---- 统计：任务数、已完成任务数、贡献数 ----
    const [taskStats, contributionStats] = await Promise.all([
      prisma.collabTask.groupBy({
        by: ['status'],
        where: { projectId: id },
        _count: { status: true },
      }),
      prisma.collabContribution.groupBy({
        by: ['status'],
        where: { projectId: id },
        _count: { status: true },
      }),
    ]);

    // 任务统计聚合
    const taskSummary = {
      total: taskStats.reduce((sum, t) => sum + t._count.status, 0),
      open: 0,
      in_progress: 0,
      review: 0,
      completed: 0,
      cancelled: 0,
    };
    taskStats.forEach((t) => {
      if (t.status in taskSummary) {
        (taskSummary as Record<string, number>)[t.status] = t._count.status;
      }
    });

    // 贡献统计聚合
    const contributionSummary = {
      total: contributionStats.reduce((sum, c) => sum + c._count.status, 0),
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    contributionStats.forEach((c) => {
      if (c.status in contributionSummary) {
        (contributionSummary as Record<string, number>)[c.status] = c._count.status;
      }
    });

    // ---- 浏览量 +1 ----
    const updated = await prisma.collabProject.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    // ---- 通过 GitHub API 获取仓库最近提交和贡献者（不阻塞主流程，失败返回空） ----
    const [repoInfo, commits, contributors] = await Promise.all([
      fetchGithubRepoInfo(project.repoOwner, project.repoName),
      fetchGithubCommits(
        project.repoOwner,
        project.repoName,
        project.defaultBranch || undefined,
        5,
      ),
      fetchGithubContributors(project.repoOwner, project.repoName, 10),
    ]);

    // ---- 如果仓库默认分支为空，尝试从 GitHub 信息补全 ----
    if (!project.defaultBranch && repoInfo?.defaultBranch) {
      await prisma.collabProject.update({
        where: { id },
        data: { defaultBranch: repoInfo.defaultBranch },
      });
    }

    return NextResponse.json({
      ...project,
      techStack: project.techStack ? JSON.parse(project.techStack) : [],
      tags: project.tags ? JSON.parse(project.tags) : [],
      viewCount: updated.viewCount,
      taskStats: taskSummary,
      contributionStats: contributionSummary,
      github: {
        repoInfo,
        commits,
        contributors,
      },
    });
  } catch (error) {
    console.error('[COLLAB PROJECT DETAIL ERROR]', error);
    return NextResponse.json(
      { error: '获取项目详情失败' },
      { status: 500 },
    );
  }
}

// ============ PATCH /api/collab/projects/[id] - 更新项目 ============
// 仅 owner / maintainer 可操作
// 可更新: title, description, goals, requirements, status, maxMembers, techStack, tags
export async function PATCH(
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
    const existing = await prisma.collabProject.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 },
      );
    }

    // ---- 权限检查：owner / maintainer（或管理员） ----
    const isManager =
      existing.authorId === user.userId ||
      user.role === 'ADMIN' ||
      (await isProjectManager(id, user.userId));

    if (!isManager) {
      return NextResponse.json(
        { error: '无权修改此项目，仅 owner 或 maintainer 可操作' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      goals,
      requirements,
      status,
      maxMembers,
      techStack,
      tags,
    } = body;

    // ---- 输入校验 ----
    if (title !== undefined && (!title || title.length > 100)) {
      return NextResponse.json(
        { error: '标题不能为空且不能超过 100 个字符' },
        { status: 400 },
      );
    }

    const allowedStatuses = ['recruiting', 'active', 'completed', 'archived'];
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: '无效的项目状态' },
        { status: 400 },
      );
    }

    // ---- 构建更新数据 ----
    const data: Record<string, unknown> = {};

    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (goals !== undefined) data.goals = goals || null;
    if (requirements !== undefined) data.requirements = requirements || null;
    if (status !== undefined) data.status = status;

    if (maxMembers !== undefined) {
      const maxMembersNum =
        typeof maxMembers === 'number' && maxMembers > 0
          ? Math.min(maxMembers, 100)
          : 10;
      data.maxMembers = maxMembersNum;
    }

    if (techStack !== undefined) {
      const techStackArr = Array.isArray(techStack)
        ? techStack.filter((t: unknown) => typeof t === 'string')
        : [];
      data.techStack = stringifyJsonArray(techStackArr);
    }

    if (tags !== undefined) {
      const tagsArr = Array.isArray(tags)
        ? tags.filter((t: unknown) => typeof t === 'string')
        : [];
      data.tags = stringifyJsonArray(tagsArr);
    }

    // ---- 更新项目 ----
    const project = await prisma.collabProject.update({
      where: { id },
      data,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
            githubLogin: true,
          },
        },
      },
    });

    return NextResponse.json({
      ...project,
      techStack: project.techStack ? JSON.parse(project.techStack) : [],
      tags: project.tags ? JSON.parse(project.tags) : [],
    });
  } catch (error) {
    console.error('[COLLAB PROJECT UPDATE ERROR]', error);
    return NextResponse.json(
      { error: '更新项目失败' },
      { status: 500 },
    );
  }
}

// ============ DELETE /api/collab/projects/[id] - 删除项目 ============
// 仅 owner 或 ADMIN
export async function DELETE(
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
    const existing = await prisma.collabProject.findUnique({
      where: { id },
      select: { id: true, authorId: true, title: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 },
      );
    }

    // ---- 权限检查：owner（创建者）或 ADMIN ----
    if (existing.authorId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权删除此项目，仅项目发起人或管理员可操作' },
        { status: 403 },
      );
    }

    // ---- 删除项目（关联的成员、任务、贡献会级联删除） ----
    await prisma.collabProject.delete({
      where: { id },
    });

    return NextResponse.json({ message: '项目已删除' });
  } catch (error) {
    console.error('[COLLAB PROJECT DELETE ERROR]', error);
    return NextResponse.json(
      { error: '删除项目失败' },
      { status: 500 },
    );
  }
}
