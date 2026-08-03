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
import { revalidateCommunityHome } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

// ============ GET /api/collab/projects/[id] - 获取项目详情 ============
// 包含: 项目信息、作者信息、成员列表（含用户信息）、任务统计、贡献统计
// 同时通过 GitHub API 获取仓库最近5条提交和贡献者统计
// 增加浏览量 viewCount
// 返回 isMember / myRole 供前端判断编辑权限
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

    // ---- 获取当前登录用户（可选，未登录时 isMember=false） ----
    const currentUser = getUserFromRequest(request);
    const currentUserId = currentUser?.userId || null;

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

    // ---- 统计：任务数、已完成任务数、贡献数（顺序执行，避免并发连接失败） ----
    let taskStats: { status: string; _count: { status: number } }[] = [];
    let contributionStats: { status: string; _count: { status: number } }[] = [];

    try {
      taskStats = await prisma.collabTask.groupBy({
        by: ['status'],
        where: { projectId: id },
        _count: { status: true },
      });
    } catch (err) {
      console.error('[COLLAB TASK STATS ERROR]', err);
    }

    try {
      contributionStats = await prisma.collabContribution.groupBy({
        by: ['status'],
        where: { projectId: id },
        _count: { status: true },
      });
    } catch (err) {
      console.error('[COLLAB CONTRIBUTION STATS ERROR]', err);
    }

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

    // ---- 查询当前用户在项目中的成员身份 ----
    // 前端依赖 isMember / myRole 判断是否显示编辑按钮、加入/离开按钮等
    let myRole: string | null = null;
    let isMember = false;
    if (currentUserId) {
      const myMember = await prisma.collabMember.findUnique({
        where: {
          projectId_userId: { projectId: id, userId: currentUserId },
        },
        select: { role: true, status: true },
      });
      if (myMember && myMember.status === 'active') {
        myRole = myMember.role;
        isMember = true;
      }
    }

    // ---- 通过 GitHub API 获取仓库最近提交和贡献者 ----
    // 使用 Promise.allSettled + 超时保护，避免新建项目仓库无数据或 GitHub API 限流
    // 导致整个详情接口卡住/失败（此前是创建协同任务后无法打开详情页的根本原因）。
    const withTimeout = <T>(p: Promise<T>, ms = 8000): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((resolve) => setTimeout(() => resolve(null as T), ms)),
      ]);

    const [repoInfoResult, commitsResult, contributorsResult] =
      await Promise.allSettled([
        withTimeout(fetchGithubRepoInfo(project.repoOwner, project.repoName)),
        withTimeout(
          fetchGithubCommits(
            project.repoOwner,
            project.repoName,
            project.defaultBranch || undefined,
            5,
          ),
        ),
        withTimeout(
          fetchGithubContributors(project.repoOwner, project.repoName, 10),
        ),
      ]);

    const repoInfo =
      repoInfoResult.status === 'fulfilled' ? repoInfoResult.value : null;
    const commits =
      commitsResult.status === 'fulfilled' ? commitsResult.value : [];
    const contributors =
      contributorsResult.status === 'fulfilled' ? contributorsResult.value : [];

    // ---- 如果仓库默认分支为空，尝试从 GitHub 信息补全 ----
    if (!project.defaultBranch && repoInfo?.defaultBranch) {
      try {
        await prisma.collabProject.update({
          where: { id },
          data: { defaultBranch: repoInfo.defaultBranch },
        });
      } catch {
        // 补全默认分支失败不影响主流程
      }
    }

    // ---- 计算前端期望的扁平字段（taskTotal/taskCompleted/contributionCount） ----
    // API 此前只返回 taskStats/contributionStats 对象，与前端 ProjectDetail 类型不匹配，
    // 导致详情页任务完成率等数据为 undefined，渲染异常。
    const taskTotal = taskSummary.total;
    const taskCompleted = taskSummary.completed;
    const contributionCount = contributionSummary.total;

    // ---- 映射关联字段为前端 ProjectDetail 期望的结构 ----
    // Prisma 返回 author/members.user 嵌套结构，前端类型期望 owner(扁平) 与
    // members(扁平: userId/username/avatar/githubUsername)。此前直接展开 ...project
    // 导致 project.owner 为 undefined，前端访问 project.owner.username 抛 TypeError，
    // 触发 Error Boundary（"页面出错了"）。
    const owner = project.author
      ? {
          id: project.author.id,
          username: project.author.username,
          avatar: project.author.avatar ?? null,
          githubUsername: project.author.githubLogin ?? undefined,
        }
      : { id: '', username: '未知用户', avatar: null };

    const members = (project.members || []).map((m) => ({
      id: m.id,
      userId: m.user?.id ?? '',
      username: m.user?.username ?? '未知用户',
      avatar: m.user?.avatar ?? null,
      role: m.role,
      githubUsername: m.user?.githubLogin ?? undefined,
      joinedAt: m.joinedAt,
    }));

    // 解析 JSON 数组或逗号分隔字符串
    const parseListValue = (value: string | null | undefined): string[] => {
      if (!value || typeof value !== 'string') return [];
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch { /* not JSON, fall through */ }
      return trimmed.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    };

    return NextResponse.json({
      ...project,
      techStack: parseListValue(project.techStack),
      tags: parseListValue(project.tags),
      viewCount: updated.viewCount,
      // 关联字段（前端 ProjectDetail 期望的扁平结构）
      owner,
      members,
      // 扁平字段（前端 ProjectDetail 期望）
      taskTotal,
      taskCompleted,
      contributionCount,
      // 当前用户的成员身份（前端依赖此字段控制编辑按钮、加入/离开按钮等）
      isMember,
      myRole,
      // 统计明细（保留供其他场景使用）
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
      techStack: project.techStack ? (() => { try { const p = JSON.parse(project.techStack); return Array.isArray(p) ? p : project.techStack.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean); } catch { return project.techStack.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean); } })() : [],
      tags: project.tags ? (() => { try { const p = JSON.parse(project.tags); return Array.isArray(p) ? p : project.tags.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean); } catch { return project.tags.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean); } })() : [],
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

    // 清除社区首页缓存，避免删除后首页仍展示该召集令
    revalidateCommunityHome();

    return NextResponse.json({ message: '项目已删除' });
  } catch (error) {
    console.error('[COLLAB PROJECT DELETE ERROR]', error);
    return NextResponse.json(
      { error: '删除项目失败' },
      { status: 500 },
    );
  }
}
