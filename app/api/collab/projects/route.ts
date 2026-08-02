import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDb, queryWithTimeout } from '@/lib/db';
import { checkDbOr503 } from '@/lib/db-check';
import type { InValue } from '@libsql/client';
import { getUserFromRequest } from '@/lib/auth';
import { parseGithubRepoUrl, stringifyJsonArray } from '@/lib/collab';
import { revalidateCommunityHome } from '@/lib/revalidate';

const QUERY_TIMEOUT = 6000;

// ============ GET /api/collab/projects - 获取召集令列表 ============
// 使用原生 SQL 替代 Prisma
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(searchParams.get('pageSize') || '10', 10), 1),
      50,
    );
    const status = searchParams.get('status') || undefined;
    const keyword = searchParams.get('keyword')?.trim() || undefined;

    // ---- 动态构建 WHERE ----
    const conditions: string[] = [];
    const args: InValue[] = [];

    if (status) {
      conditions.push('cp.status = ?');
      args.push(status);
    }

    if (keyword) {
      conditions.push(`(cp.title LIKE '%' || ? || '%' OR cp.description LIKE '%' || ? || '%')`);
      args.push(keyword, keyword);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (page - 1) * pageSize;

    let db;
    const dbError = checkDbOr503();
    if (dbError) return dbError;
    try {
      db = getDb();
    } catch {
      return NextResponse.json({ data: [], total: 0, page, pageSize, totalPages: 1 });
    }

    // ---- 并行查询列表 + 总数 ----
    const listArgs = [...args];
    const countArgs = [...args];

    const [projectRows, countRows] = await Promise.all([
      queryWithTimeout(
        db,
        `SELECT cp.id, cp.title, substr(cp.description, 1, 500) as description,
                cp.repo_url, cp.repo_owner, cp.repo_name, cp.repo_created,
                cp.default_branch, cp.tech_stack, cp.tags, cp.goals, cp.requirements,
                cp.status, cp.max_members, cp.member_count, cp.task_count,
                cp.completed_task_count, cp.contribution_count, cp.view_count,
                cp.created_at, cp.updated_at,
                u.id as author_id, u.username as author_username,
                u.avatar as author_avatar, u.github_login as author_github_login
         FROM CollabProject cp
         LEFT JOIN User u ON cp.author_id = u.id
         ${whereClause}
         ORDER BY cp.status ASC, cp.created_at DESC
         LIMIT ? OFFSET ?`,
        [...listArgs, pageSize, offset],
        QUERY_TIMEOUT,
      ),
      queryWithTimeout(
        db,
        `SELECT COUNT(*) as total FROM CollabProject cp ${whereClause}`,
        countArgs,
        QUERY_TIMEOUT,
      ),
    ]);

    const total = Number((countRows as Record<string, unknown>[])[0]?.total) || 0;

    // ---- 解析 JSON 字段并映射前端字段名 ----
    const parseJsonArray = (value: unknown): string[] => {
      if (!value || typeof value !== 'string') return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    };

    const data = (projectRows as Record<string, unknown>[]).map((p) => {
      const author = {
        id: p.author_id || '',
        username: p.author_username || '匿名',
        avatar: p.author_avatar || null,
        githubLogin: p.author_github_login || null,
      };
      return {
        id: p.id,
        title: p.title,
        description: p.description || '',
        repoUrl: p.repo_url || '',
        repoOwner: p.repo_owner || '',
        repoName: p.repo_name || '',
        repoCreated: Boolean(p.repo_created),
        defaultBranch: p.default_branch || null,
        techStack: parseJsonArray(p.tech_stack),
        tags: parseJsonArray(p.tags),
        goals: p.goals || null,
        requirements: p.requirements || null,
        status: p.status,
        maxMembers: Number(p.max_members) || 10,
        memberCount: Number(p.member_count) || 0,
        taskCount: Number(p.task_count) || 0,
        completedTaskCount: Number(p.completed_task_count) || 0,
        contributionCount: Number(p.contribution_count) || 0,
        viewCount: Number(p.view_count) || 0,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        author,
        // 前端期望的别名
        taskTotal: Number(p.task_count) || 0,
        taskCompleted: Number(p.completed_task_count) || 0,
        owner: author,
      };
    });

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('[COLLAB PROJECTS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取召集令列表失败' },
      { status: 500 },
    );
  }
}

// ============ POST /api/collab/projects - 创建新召集令 ============
// 保持 Prisma（写操作）
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      repoUrl,
      techStack,
      tags,
      goals,
      requirements,
      maxMembers,
    } = body;

    if (!title || !description || !repoUrl) {
      return NextResponse.json(
        { error: '标题、描述和仓库地址不能为空' },
        { status: 400 },
      );
    }

    if (title.length > 100) {
      return NextResponse.json(
        { error: '标题不能超过 100 个字符' },
        { status: 400 },
      );
    }

    const parsed = parseGithubRepoUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: '无法解析 GitHub 仓库地址，请提供有效的仓库 URL（如 https://github.com/owner/repo）' },
        { status: 400 },
      );
    }

    const { owner: repoOwner, repo: repoName } = parsed;
    const normalizedRepoUrl = `https://github.com/${repoOwner}/${repoName}`;

    const techStackArr = Array.isArray(techStack)
      ? techStack.filter((t: unknown) => typeof t === 'string')
      : [];
    const tagsArr = Array.isArray(tags)
      ? tags.filter((t: unknown) => typeof t === 'string')
      : [];

    const maxMembersNum =
      typeof maxMembers === 'number' && maxMembers > 0
        ? Math.min(maxMembers, 100)
        : 10;

    const creator = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { githubLogin: true },
    });

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.collabProject.create({
        data: {
          title,
          description,
          authorId: user.userId,
          repoUrl: normalizedRepoUrl,
          repoOwner,
          repoName,
          repoCreated: false,
          techStack: stringifyJsonArray(techStackArr),
          tags: stringifyJsonArray(tagsArr),
          goals: goals || null,
          requirements: requirements || null,
          status: 'recruiting',
          maxMembers: maxMembersNum,
          memberCount: 1,
        },
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

      await tx.collabMember.create({
        data: {
          projectId: created.id,
          userId: user.userId,
          role: 'owner',
          status: 'active',
          githubLogin: creator?.githubLogin || null,
        },
      });

      return created;
    });

    revalidateCommunityHome();

    return NextResponse.json(
      {
        ...project,
        techStack: techStackArr,
        tags: tagsArr,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[COLLAB PROJECT CREATE ERROR]', error);
    return NextResponse.json(
      { error: '创建召集令失败' },
      { status: 500 },
    );
  }
}
