import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/stats - 公开统计接口（无需鉴权）
 *
 * 返回首页展示所需的统计数据：工具数、用户数、帖子数
 * 数据库不可用时降级返回零值
 */
export async function GET() {
  try {
    const [toolCount, userCount, postCount, todayPostCount] = await Promise.all([
      prisma.tool.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.post.count({ where: { status: 'PUBLISHED' } }),
      prisma.post.count({
        where: {
          status: 'PUBLISHED',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    const response = NextResponse.json({
      toolCount,
      userCount,
      postCount,
      todayPostCount,
    });
    // 统计数据可缓存 10 分钟（减少数据库查询）
    response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');
    return response;
  } catch (error) {
    console.error('[PUBLIC STATS ERROR]', error);
    // 返回 503 让前端能识别错误，而不是用零值覆盖已有数据
    return NextResponse.json(
      { error: '统计数据暂时不可用' },
      { status: 503 }
    );
  }
}
