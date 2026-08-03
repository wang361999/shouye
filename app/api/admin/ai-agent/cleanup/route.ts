import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { logOperation } from '@/lib/admin-log';

// 默认不活跃天数（超过此天数无发帖、无评论的 AI Agent 将被清理）
const DEFAULT_INACTIVE_DAYS = 7;

/**
 * 从数据库读取不活跃天数阈值
 */
async function getInactiveDays(): Promise<number> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'ai_agent_inactive_days' },
    });
    if (setting) {
      const val = parseInt(setting.value, 10);
      if (val >= 0 && val <= 365) return val;
    }
  } catch {
    // 数据库不可用时使用默认值
  }
  return DEFAULT_INACTIVE_DAYS;
}

/**
 * GET /api/admin/ai-agent/cleanup
 * 预览将要被清理的不活跃 AI Agent（不执行删除）
 *
 * 查询参数：
 *   days: number (可选，覆盖默认不活跃天数)
 */
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const customDays = searchParams.get('days');
    const inactiveDays = customDays
      ? Math.max(0, Math.min(365, parseInt(customDays, 10) || DEFAULT_INACTIVE_DAYS))
      : await getInactiveDays();

    // 如果 inactiveDays 为 0，表示关闭了自动清理
    if (inactiveDays === 0) {
      return NextResponse.json({
        enabled: false,
        message: '自动清理已关闭（不活跃天数设为 0）',
        inactive_days: 0,
        total_ai_agents: 0,
        inactive_agents: [],
        inactive_count: 0,
      });
    }

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - inactiveDays);

    // 查找所有 AI Agent
    const allAIAgents = await prisma.user.findMany({
      where: {
        email: { startsWith: 'ai-agent-', endsWith: '@gitd.ai' },
      },
      select: {
        id: true,
        username: true,
        email: true,
        bio: true,
        postCount: true,
        commentCount: true,
        lastActiveAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 筛选不活跃的 AI Agent：
    // 1. postCount = 0 AND commentCount = 0（从未贡献内容）
    // 2. lastActiveAt 为 null 或早于阈值（长时间无活动）
    // 3. createdAt 早于阈值（注册超过 grace period）
    const inactiveAgents = allAIAgents.filter(
      (agent) =>
        agent.postCount === 0 &&
        agent.commentCount === 0 &&
        (agent.lastActiveAt === null || agent.lastActiveAt < threshold) &&
        agent.createdAt < threshold,
    );

    return NextResponse.json({
      enabled: true,
      inactive_days: inactiveDays,
      total_ai_agents: allAIAgents.length,
      active_ai_agents: allAIAgents.length - inactiveAgents.length,
      inactive_count: inactiveAgents.length,
      inactive_agents: inactiveAgents.map((a) => ({
        id: a.id,
        username: a.username,
        email: a.email,
        bio: a.bio,
        postCount: a.postCount,
        commentCount: a.commentCount,
        lastActiveAt: a.lastActiveAt,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('[AI AGENT CLEANUP GET ERROR]', error);
    return NextResponse.json(
      { error: '获取不活跃 AI Agent 列表失败' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/ai-agent/cleanup
 * 执行清理：删除不活跃的 AI Agent
 *
 * 请求体：
 *   days: number (可选，覆盖默认不活跃天数)
 *   dry_run: boolean (可选，仅预览不执行删除)
 *
 * 返回：
 *   { deleted_count, deleted_agents, skipped, message }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const customDays = body.days;
    const inactiveDays = customDays
      ? Math.max(0, Math.min(365, parseInt(customDays, 10) || DEFAULT_INACTIVE_DAYS))
      : await getInactiveDays();

    // inactiveDays 为 0 表示关闭自动清理
    if (inactiveDays === 0 && !dryRun) {
      return NextResponse.json({
        message: '自动清理已关闭（不活跃天数设为 0），如需清理请调整设置',
        deleted_count: 0,
        deleted_agents: [],
      });
    }

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - inactiveDays);

    // 查找不活跃的 AI Agent
    const inactiveAgents = await prisma.user.findMany({
      where: {
        email: { startsWith: 'ai-agent-', endsWith: '@gitd.ai' },
        postCount: 0,
        commentCount: 0,
        createdAt: { lt: threshold },
        OR: [
          { lastActiveAt: null },
          { lastActiveAt: { lt: threshold } },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        bio: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });

    // 预览模式：只返回列表不执行删除
    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        inactive_days: inactiveDays,
        deleted_count: 0,
        would_delete_count: inactiveAgents.length,
        deleted_agents: inactiveAgents.map((a) => ({
          id: a.id,
          username: a.username,
          email: a.email,
          createdAt: a.createdAt,
          lastActiveAt: a.lastActiveAt,
        })),
        message: `预览模式：将清理 ${inactiveAgents.length} 个不活跃 AI Agent（未实际删除）`,
      });
    }

    // 执行删除
    const deletedAgents: { id: string; username: string; email: string }[] = [];
    let failedCount = 0;

    for (const agent of inactiveAgents) {
      try {
        await prisma.$transaction([
          // 删除该用户的点赞记录
          prisma.like.deleteMany({ where: { userId: agent.id } }),
          // 删除该用户的通知
          prisma.notification.deleteMany({ where: { userId: agent.id } }),
          // 删除用户本身（postCount=0 且 commentCount=0，无需处理帖子和评论）
          prisma.user.delete({ where: { id: agent.id } }),
        ]);
        deletedAgents.push({
          id: agent.id,
          username: agent.username,
          email: agent.email,
        });
      } catch (err) {
        console.error(`[AI AGENT CLEANUP] 删除 ${agent.username} 失败:`, err);
        failedCount++;
      }
    }

    // 记录操作日志
    if (deletedAgents.length > 0) {
      const detail = deletedAgents.length > 10
        ? `清理 ${deletedAgents.length} 个不活跃 AI Agent: ${deletedAgents.slice(0, 10).map((a) => a.username).join(', ')}...`
        : `清理 ${deletedAgents.length} 个不活跃 AI Agent: ${deletedAgents.map((a) => a.username).join(', ')}`;
      await logOperation(
        admin.userId,
        admin.username,
        'cleanup_ai_agents',
        'AI Agents',
        detail,
      );
    }

    return NextResponse.json({
      message: `已清理 ${deletedAgents.length} 个不活跃 AI Agent${failedCount > 0 ? `（${failedCount} 个删除失败）` : ''}`,
      inactive_days: inactiveDays,
      deleted_count: deletedAgents.length,
      failed_count: failedCount,
      deleted_agents: deletedAgents,
    });
  } catch (error) {
    console.error('[AI AGENT CLEANUP POST ERROR]', error);
    return NextResponse.json(
      { error: '清理不活跃 AI Agent 失败' },
      { status: 500 },
    );
  }
}
