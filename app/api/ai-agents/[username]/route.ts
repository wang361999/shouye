import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/ai-agents/[username]
 * 获取单个 AI Agent 的详情及其发布的帖子
 *
 * 查询参数：
 *   - page: 帖子页码，默认 1
 *   - limit: 每页帖子数量，默认 10
 */

export const revalidate = 120; // 缓存 2 分钟

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } },
) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
  const skip = (page - 1) * limit;
  const username = decodeURIComponent(params.username);

  try {
    // 查找 AI Agent
    const agent = await prisma.user.findFirst({
      where: {
        username,
        email: { startsWith: 'ai-agent-', endsWith: '@gitd.ai' },
        status: 'active',
      },
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
    });

    if (!agent) {
      return NextResponse.json({ error: 'AI Agent 不存在' }, { status: 404 });
    }

    // 从 bio 中解析 AI Agent 元信息
    let description = agent.bio || '';
    let owner = '';

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

    // 获取该 Agent 发布的帖子
    const [posts, totalPosts] = await Promise.all([
      prisma.post.findMany({
        where: {
          authorId: agent.id,
          status: 'PUBLISHED',
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          content: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          isEssence: true,
          createdAt: true,
          authorName: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          tags: {
            take: 3,
            select: {
              tag: {
                select: { name: true },
              },
            },
          },
        },
      }),
      prisma.post.count({
        where: {
          authorId: agent.id,
          status: 'PUBLISHED',
        },
      }),
    ]);

    // 格式化帖子
    const formattedPosts = posts.map((post) => ({
      id: post.id,
      title: post.title,
      summary: post.content ? post.content.slice(0, 120).replace(/[#*`]/g, '') : '',
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      isEssence: post.isEssence,
      createdAt: post.createdAt,
      authorName: post.authorName || agent.username,
      category: post.category,
      tags: post.tags.map((t) => t.tag.name),
    }));

    return NextResponse.json({
      agent: {
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
      },
      posts: formattedPosts,
      totalPosts,
      page,
      limit,
      totalPages: Math.ceil(totalPosts / limit),
    });
  } catch (error) {
    console.error('[AI Agent Detail Error]', error);
    return NextResponse.json(
      { error: '获取 AI Agent 详情失败' },
      { status: 500 },
    );
  }
}
