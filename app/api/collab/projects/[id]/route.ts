import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDb, queryWithTimeout } from '@/lib/db';
import { checkDbOr503 } from '@/lib/db-check';
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

const QUERY_TIMEOUT = 8000;

// 解析 JSON 数组或逗号分隔字符串
function parseListValue(value: unknown): string[] {
  if (!value || typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* not JSON, fall through */ }
  return trimmed.split(/[,，]/).map(s => s.trim()).filter(Boolean);
}

// ============ GET /api/collab/projects/[id] - 获取项目详情 ============
// 使用原生 SQL 替代 Prisma，避免 Vercel Serverless 并发查询失败
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let db;
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '无效的项目 ID' },
        { status: 400 },
      );
    }

    // ---- 获取当前登录用户 ----
    const currentUser = getUserFromRequest(request);
    const currentUserId = currentUser?.userId || null;

    const dbError = checkDbOr503();
    if (dbError) return dbError;
    db = getDb();

    // ---- 1. 查询项目 + 作者信息 ----
    let projectRows: Record<string, unknown>[] = [];
    try {
      const rows = await queryWithTimeout(
        db,
        `SELECT cp.*,
                u.id as author_id, u.username as author_username, u.avatar as author_avatar,
                u.github_login as author_github_login, u.bio as author_bio
         FROM CollabProject cp
         LEFT JOIN User u ON cp.author_id = u.id
         WHERE cp.id = ?`,
        [id],
        QUERY_TIMEOUT,
      );
      projectRows = rows as Record<string, unknown>[];
    } catch (err) {
      console.error('[COLLAB PROJECT QUERY ERROR]', err);
      return NextResponse.json(
        { error: '获取项目详情失败', detail: err instanceof Error ? err.message : '' },
        { status: 503 },
      );
    }

    const project = projectRows[0];
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    // ---- 2. 查询成员列表（顺序执行，避免并发请求失败） ----
    let memberRows: Record<string, unknown>[] = [];
    try {
      const rows = await queryWithTimeout(
        db,
        `SELECT cm.id, cm.project_id, cm.user_id, cm.role, cm.status,
                cm.github_login as member_github_login, cm.joined_at, cm.left_at,
                u.id as user_id, u.username as user_username, u.avatar as user_avatar,
                u.github_login as user_github_login, u.bio as user_bio
         FROM CollabMember cm
         LEFT JOIN User u ON cm.user_id = u.id
         WHERE cm.project_id = ? AND cm.status = 'active'
         ORDER BY cm.role ASC, cm.joined_at ASC`,
        [id],
        QUERY_TIMEOUT,
      );
      memberRows = rows as Record<string, unknown>[];
    } catch (err) {
      console.error('[COLLAB MEMBERS QUERY ERROR]', err);
    }

    // ---- 3. 任务统计 ----
    let taskSummary = { total: 0, open: 0, in_progress: 0, review: 0, completed: 0, cancelled: 0 };
    try {
      const rows = await queryWithTimeout(
        db,
        `SELECT status, COUNT(*) as cnt FROM CollabTask WHERE project_id = ? GROUP BY status`,
        [id],
        QUERY_TIMEOUT,
      );
      let total = 0;
      for (const row of rows as Record<string, unknown>[]) {
        const cnt = Number(row.cnt) || 0;
        total += cnt;
        const status = row.status as string;
        if (status in taskSummary) {
          (taskSummary as Record<string, number>)[status] = cnt;
        }
      }
      taskSummary.total = total;
    } catch (err) {
      console.error('[COLLAB TASK STATS ERROR]', err);
    }

    // ---- 4. 贡献统计 ----
    let contributionSummary = { total: 0, pending: 0, approved: 0, rejected: 0 };
    try {
      const rows = await queryWithTimeout(
        db,
        `SELECT status, COUNT(*) as cnt FROM CollabContribution WHERE project_id = ? GROUP BY status`,
        [id],
        QUERY_TIMEOUT,
      );
      let total = 0;
      for (const row of rows as Record<string, unknown>[]) {
        const cnt = Number(row.cnt) || 0;
        total += cnt;
        const status = row.status as string;
        if (status in contributionSummary) {
          (contributionSummary as Record<string, number>)[status] = cnt;
        }
      }
      contributionSummary.total = total;
    } catch (err) {
      console.error('[COLLAB CONTRIBUTION STATS ERROR]', err);
    }

    // ---- 5. 浏览量 +1 ----
    let viewCount = Number(project.view_count || 0) + 1;
    try {
      await queryWithTimeout(
        db,
        `UPDATE CollabProject SET view_count = view_count + 1 WHERE id = ?`,
        [id],
        QUERY_TIMEOUT,
      );
    } catch (err) {
      console.error('[COLLAB VIEWCOUNT ERROR]', err);
    }

    // ---- 6. 当前用户成员身份 ----
    let myRole: string | null = null;
    let isMember = false;
    if (currentUserId) {
      try {
        const rows = await queryWithTimeout(
          db,
          `SELECT role, status FROM CollabMember WHERE project_id = ? AND user_id = ?`,
          [id, currentUserId],
          QUERY_TIMEOUT,
        );
        const myMember = (rows as Record<string, unknown>[])[0];
        if (myMember && myMember.status === 'active') {
          myRole = myMember.role as string;
          isMember = true;
        }
      } catch (err) {
        console.error('[COLLAB MYMEMBER ERROR]', err);
      }
    }

    // ---- 7. GitHub API 信息获取 ----
    const withTimeout = <T>(p: Promise<T>, ms = 8000): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((resolve) => setTimeout(() => resolve(null as T), ms)),
      ]);

    let repoInfo = null;
    let commits: unknown[] = [];
    let contributors: unknown[] = [];
    try {
      const [repoInfoResult, commitsResult, contributorsResult] =
        await Promise.allSettled([
          withTimeout(fetchGithubRepoInfo(project.repo_owner as string, project.repo_name as string)),
          withTimeout(fetchGithubCommits(project.repo_owner as string, project.repo_name as string, (project.default_branch as string) || undefined, 5)),
          withTimeout(fetchGithubContributors(project.repo_owner as string, project.repo_name as string, 10)),
        ]);
      repoInfo = repoInfoResult.status === 'fulfilled' ? repoInfoResult.value : null;
      commits = commitsResult.status === 'fulfilled' ? (commitsResult.value as unknown[]) : [];
      contributors = contributorsResult.status === 'fulfilled' ? (contributorsResult.value as unknown[]) : [];
    } catch (err) {
      console.error('[COLLAB GITHUB API ERROR]', err);
    }

    // ---- 组装返回数据 ----
    const owner = project.author_id
      ? {
          id: project.author_id,
          username: project.author_username || '未知用户',
          avatar: project.author_avatar || null,
          githubUsername: project.author_github_login || undefined,
        }
      : { id: '', username: '未知用户', avatar: null };

    const members = memberRows.map((m) => ({
      id: m.id,
      userId: m.user_id ?? '',
      username: (m.user_username as string) || '未知用户',
      avatar: m.user_avatar || null,
      role: m.role as string,
      githubUsername: m.user_github_login || undefined,
      joinedAt: m.joined_at,
    }));

    return NextResponse.json({
      id: project.id,
      title: project.title,
      description: project.description,
      authorId: project.author_id,
      repoOwner: project.repo_owner,
      repoName: project.repo_name,
      defaultBranch: project.default_branch,
      techStack: parseListValue(project.tech_stack),
      tags: parseListValue(project.tags),
      goals: project.goals,
      requirements: project.requirements,
      status: project.status,
      maxMembers: Number(project.max_members) || 0,
      memberCount: Number(project.member_count) || 0,
      taskCount: Number(project.task_count) || 0,
      completedTaskCount: Number(project.completed_task_count) || 0,
      contributionCount: Number(project.contribution_count) || 0,
      viewCount,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      owner,
      members,
      taskTotal: taskSummary.total,
      taskCompleted: taskSummary.completed,
      contributionCountStat: contributionSummary.total,
      isMember,
      myRole,
      taskStats: taskSummary,
      contributionStats: contributionSummary,
      github: { repoInfo, commits, contributors },
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
