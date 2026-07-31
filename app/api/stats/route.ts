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
    const [toolCount, userCount, postCount] = await Promise.all([
      prisma.tool.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.post.count({ where: { status: { not: 'DELETED' } } }),
    ]);

    return NextResponse.json({
      toolCount,
      userCount,
      postCount,
    });
  } catch (error) {
    console.error('[PUBLIC STATS ERROR]', error);
    // 降级返回零值，不暴露错误详情
    return NextResponse.json({
      toolCount: 0,
      userCount: 0,
      postCount: 0,
    });
  }
}
