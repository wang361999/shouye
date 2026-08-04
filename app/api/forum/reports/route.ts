import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, adminAuth } from '@/lib/auth';
import { notifyAllAdmins } from '@/lib/notify';

// 允许的举报目标类型
const ALLOWED_TARGET_TYPES = ['post', 'comment'];
// 允许的举报原因
const ALLOWED_REASONS = ['spam', 'abuse', 'inappropriate', 'other'];

// ============ GET /api/forum/reports - 管理员获取举报列表 ============
// 支持 ?status=pending|resolved|dismissed 筛选，分页
export async function GET(request: NextRequest) {
  try {
    // 管理员鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const [total, reports] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: reports,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[REPORTS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取举报列表失败' },
      { status: 500 }
    );
  }
}

// ============ POST /api/forum/reports - 提交举报（需登录） ============
// body: { targetType, targetId, reason, description? }
export async function POST(request: NextRequest) {
  try {
    // 登录鉴权
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { targetType, targetId, reason, description } = body;

    // ---- 输入校验 ----
    if (!targetType || !targetId || !reason) {
      return NextResponse.json(
        { error: '举报类型、目标 ID 和原因不能为空' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TARGET_TYPES.includes(targetType)) {
      return NextResponse.json(
        { error: '无效的举报类型，仅支持 post 或 comment' },
        { status: 400 }
      );
    }

    if (!ALLOWED_REASONS.includes(reason)) {
      return NextResponse.json(
        { error: '无效的举报原因' },
        { status: 400 }
      );
    }

    // ---- 防止同一用户重复举报同一目标 ----
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: user.userId,
        targetType,
        targetId,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: '你已举报过该内容，请勿重复举报' },
        { status: 409 }
      );
    }

    // ---- 校验目标是否存在 ----
    if (targetType === 'post') {
      const post = await prisma.post.findUnique({ where: { id: targetId } });
      if (!post || post.status === 'DELETED') {
        return NextResponse.json(
          { error: '举报的帖子不存在' },
          { status: 404 }
        );
      }
    } else {
      const comment = await prisma.comment.findFirst({
        where: { id: targetId, deletedAt: null },
      });
      if (!comment) {
        return NextResponse.json(
          { error: '举报的评论不存在' },
          { status: 404 }
        );
      }
    }

    // ---- 创建举报 ----
    const report = await prisma.report.create({
      data: {
        reporterId: user.userId,
        targetType,
        targetId,
        reason,
        description: description || null,
        status: 'pending',
      },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // 通知所有管理员有新举报
    const reasonMap: Record<string, string> = {
      spam: '垃圾广告',
      abuse: '辱骂攻击',
      inappropriate: '不当内容',
      other: '其他',
    };
    await notifyAllAdmins({
      type: 'system',
      title: `新举报：${reasonMap[reason] || reason}`,
      content: `${user.username} 举报了一个${targetType === 'post' ? '帖子' : '评论'}，原因：${reasonMap[reason] || reason}${description ? '，描述：' + description.slice(0, 100) : ''}`,
      link: '/admin/forum/reports',
    }).catch(() => {});

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('[REPORT CREATE ERROR]', error);
    return NextResponse.json(
      { error: '提交举报失败' },
      { status: 500 }
    );
  }
}
