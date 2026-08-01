import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { isProjectMember } from '@/lib/collab';

export const dynamic = 'force-dynamic';

// 允许的贡献类型
const ALLOWED_CONTRIBUTION_TYPES = [
  'commit',
  'pull_request',
  'issue',
  'docs',
  'other',
];

// ============ GET /api/collab/projects/[id]/contributions - 获取贡献列表 ============
// 查询参数: type, userId, status
// 返回贡献列表（含用户信息、关联任务信息）
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
    const type = searchParams.get('type') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const status = searchParams.get('status') || undefined;

    // ---- 构建查询条件 ----
    const where: Prisma.CollabContributionWhereInput = { projectId: id };

    if (type) {
      where.type = type;
    }

    if (userId) {
      where.userId = userId;
    }

    if (status) {
      where.status = status;
    }

    const contributionsRaw = await prisma.collabContribution.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
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

    // 映射为前端期望的结构：user → contributor(扁平)、githubLogin → githubUsername
    const contributions = contributionsRaw.map((c) => ({
      ...c,
      contributor: c.user
        ? {
            id: c.user.id,
            username: c.user.username,
            avatar: c.user.avatar ?? null,
            githubUsername: c.user.githubLogin ?? undefined,
          }
        : { id: '', username: '未知用户', avatar: null },
    }));

    return NextResponse.json({
      data: contributions,
      total: contributions.length,
    });
  } catch (error) {
    console.error('[COLLAB CONTRIBUTIONS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取贡献列表失败' },
      { status: 500 },
    );
  }
}

// ============ POST /api/collab/projects/[id]/contributions - 提交贡献记录 ============
// 需要登录，仅项目成员可提交
// body: type(commit/pull_request/issue/docs/other), title, description, url, commitSha, branch,
//       additions, deletions, filesChanged, taskId
// 更新项目 contributionCount
// 如果关联了 taskId，在任务下显示该贡献
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

    // ---- 权限检查：仅项目成员可提交贡献 ----
    const isMember = await isProjectMember(id, user.userId);
    if (!isMember && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '仅项目成员可提交贡献记录' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      type,
      title,
      description,
      url,
      commitSha,
      branch,
      additions,
      deletions,
      filesChanged,
      taskId,
    } = body;

    // ---- 输入校验 ----
    if (!type || !ALLOWED_CONTRIBUTION_TYPES.includes(type)) {
      return NextResponse.json(
        { error: '贡献类型无效，可选值: commit / pull_request / issue / docs / other' },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: '贡献标题不能为空' },
        { status: 400 },
      );
    }

    if (title.length > 200) {
      return NextResponse.json(
        { error: '贡献标题不能超过 200 个字符' },
        { status: 400 },
      );
    }

    // 校验关联任务（若提供，必须属于该项目）
    if (taskId) {
      const task = await prisma.collabTask.findUnique({
        where: { id: taskId },
        select: { id: true, projectId: true },
      });
      if (!task || task.projectId !== id) {
        return NextResponse.json(
          { error: '关联的任务不存在或不属于该项目' },
          { status: 400 },
        );
      }
    }

    // 规范化数值字段
    const additionsNum =
      typeof additions === 'number' && additions >= 0 ? additions : 0;
    const deletionsNum =
      typeof deletions === 'number' && deletions >= 0 ? deletions : 0;
    const filesChangedNum =
      typeof filesChanged === 'number' && filesChanged >= 0
        ? filesChanged
        : 0;

    // commitSha 截断为前 7 位
    const normalizedSha =
      typeof commitSha === 'string' && commitSha
        ? commitSha.substring(0, 7)
        : null;

    // ---- 事务：创建贡献记录 + 更新项目 contributionCount ----
    const contribution = await prisma.$transaction(async (tx) => {
      const created = await tx.collabContribution.create({
        data: {
          projectId: id,
          taskId: taskId || null,
          userId: user.userId,
          type,
          title,
          description: description || null,
          url: url || null,
          commitSha: normalizedSha,
          branch: branch || null,
          additions: additionsNum,
          deletions: deletionsNum,
          filesChanged: filesChangedNum,
          status: 'pending',
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
          task: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      });

      await tx.collabProject.update({
        where: { id },
        data: { contributionCount: { increment: 1 } },
      });

      return created;
    });

    // 映射为前端期望的结构
    const contributionMapped = {
      ...contribution,
      contributor: contribution.user
        ? {
            id: contribution.user.id,
            username: contribution.user.username,
            avatar: contribution.user.avatar ?? null,
            githubUsername: contribution.user.githubLogin ?? undefined,
          }
        : { id: '', username: '未知用户', avatar: null },
    };

    return NextResponse.json(contributionMapped, { status: 201 });
  } catch (error) {
    console.error('[COLLAB CONTRIBUTION CREATE ERROR]', error);
    return NextResponse.json(
      { error: '提交贡献记录失败' },
      { status: 500 },
    );
  }
}
