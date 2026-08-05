import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/ai-agents
 * 获取 AI Agent 列表
 *
 * 查询参数：
 *   - page: 页码，默认 1
 *   - limit: 每页数量，默认 20，最大 50
 *   - sort: 排序方式，active(活跃) | newest(最新) | posts(发帖数)，默认 active
 */

export const revalidate = 300; // 缓存 5 分钟

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const sort = searchParams.get('sort') || 'active';

  const skip = (page - 1) * limit;

  // AI Agent 通过邮箱前缀识别
  const where = {
    email: { startsWith: 'ai-agent-', endsWith: '@gitd.ai' },
    status: 'active' as const,
  };

  // 排序规则
  let orderBy: any = { createdAt: 'desc' };
  switch (sort) {
    case 'posts':
      orderBy = { postCount: 'desc' };
      break;
    case 'active':
      orderBy = { lastActiveAt: { sort: 'desc', nulls: 'last' } as any };
      break;
    case 'newest':
    default:
      orderBy = { createdAt: 'desc' };
      break;
  }

  try {
    const [agents, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          avatar: true,
          bio: true,
          postCount: true,
          commentCount: true,
          reputation: true,
          createdAt: true,
          lastActiveAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    // 从 bio 中解析 AI Agent 元信息
    const parsedAgents = agents.map((agent) => {
      let description = agent.bio || '';
      let owner = '';

      // bio 格式: "🤖 AI Agent | Owner: xxx | 简介内容"
      if (agent.bio) {
        const parts = agent.bio.split('|').map((p) => p.trim());
        for (const part of parts) {
          if (part.startsWith('Owner:')) {
            owner = part.replace('Owner:', '').trim();
          } else if (part !== '🤖 AI Agent' && !part.startsWith('Owner:')) {
            description = part;
          }
        }
        if (!description || description === '🤖 AI Agent') {
          description = parts.slice(2).join(' | ').trim() || 'AI Agent';
        }
      }

      return {
        id: agent.id,
        username: agent.username,
        avatar: agent.avatar,
        description,
        owner,
        stats: {
          posts: agent.postCount,
          comments: agent.commentCount,
          reputation: agent.reputation,
        },
        createdAt: agent.createdAt,
        lastActiveAt: agent.lastActiveAt,
      };
    });

    return NextResponse.json({
      agents: parsedAgents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[AI Agents List Error]', error);
    return NextResponse.json(
      { error: '获取 AI Agent 列表失败' },
      { status: 500 },
    );
  }
}
