import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { parseGithubRepoUrl, stringifyJsonArray } from '@/lib/collab';

export const dynamic = 'force-dynamic';

// ============ GET /api/collab/projects - 获取召集令列表 ============
// 查询参数: page, pageSize, status, keyword
// 返回: 项目列表（含作者信息、成员数、任务统计）+ 总数
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

    // ---- 构建查询条件 ----
    const where: Prisma.CollabProjectWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    // ---- 查询总数和分页数据 ----
    const [projects, total] = await Promise.all([
      prisma.collabProject.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      }),
      prisma.collabProject.count({ where }),
    ]);

    // ---- 序列化 JSON 数组字段 ----
    const data = projects.map((project) => ({
      ...project,
      techStack: project.techStack ? JSON.parse(project.techStack) : [],
      tags: project.tags ? JSON.parse(project.tags) : [],
    }));

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
// 需要登录
// body: title, description, repoUrl, techStack(数组), tags(数组), goals, requirements, maxMembers
// 自动解析 repoUrl 提取 owner/repo
// 创建项目时自动将创建者添加为 owner 成员
export async function POST(request: NextRequest) {
  try {
    // ---- 登录鉴权 ----
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

    // ---- 输入校验 ----
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

    // ---- 解析 GitHub 仓库 URL ----
    const parsed = parseGithubRepoUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: '无法解析 GitHub 仓库地址，请提供有效的仓库 URL（如 https://github.com/owner/repo）' },
        { status: 400 },
      );
    }

    const { owner: repoOwner, repo: repoName } = parsed;

    // 规范化仓库 URL（去除可能的尾部路径与 .git）
    const normalizedRepoUrl = `https://github.com/${repoOwner}/${repoName}`;

    // 校验技术栈与标签为数组
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

    // ---- 查询创建者的 GitHub 登录名（用于成员记录） ----
    const creator = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { githubLogin: true },
    });

    // ---- 事务：创建项目 + 添加创建者为 owner 成员 ----
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

      // 将创建者添加为 owner 成员
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

    // ---- 返回创建的项目（含解析后的数组字段） ----
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
