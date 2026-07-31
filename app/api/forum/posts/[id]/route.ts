import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest, adminAuth } from '@/lib/auth';

// ============ GET /api/forum/posts/[id] - 获取帖子详情 ============
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '无效的帖子 ID' },
        { status: 400 }
      );
    }

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        comments: {
          where: { parentId: null },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                author: {
                  select: {
                    id: true,
                    username: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!post || post.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在' },
        { status: 404 }
      );
    }

    // 浏览量 +1
    await prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({
      ...post,
      viewCount: post.viewCount + 1, // 返回更新后的浏览量
    });
  } catch (error) {
    console.error('[POST DETAIL ERROR]', error);
    return NextResponse.json(
      { error: '获取帖子详情失败' },
      { status: 500 }
    );
  }
}

// ============ PUT /api/forum/posts/[id] - 编辑帖子 ============
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 登录鉴权
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '无效的帖子 ID' },
        { status: 400 }
      );
    }

    // 检查帖子是否存在
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing || existing.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在' },
        { status: 404 }
      );
    }

    // 权限检查：作者本人或管理员
    if (existing.authorId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权编辑此帖子' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, content, categoryId } = body;

    // ---- 输入校验 ----
    if (!title || !content) {
      return NextResponse.json(
        { error: '标题和内容不能为空' },
        { status: 400 }
      );
    }

    if (title.length > 100) {
      return NextResponse.json(
        { error: '标题不能超过 100 个字符' },
        { status: 400 }
      );
    }

    // ---- 更新帖子 ----
    const post = await prisma.post.update({
      where: { id },
      data: {
        title,
        content,
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json(post);
  } catch (error) {
    console.error('[POST UPDATE ERROR]', error);
    return NextResponse.json(
      { error: '编辑帖子失败' },
      { status: 500 }
    );
  }
}

// ============ DELETE /api/forum/posts/[id] - 删除帖子（软删除） ============
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 登录鉴权
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '无效的帖子 ID' },
        { status: 400 }
      );
    }

    // 检查帖子是否存在
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing || existing.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在' },
        { status: 404 }
      );
    }

    // 权限检查：作者本人或管理员
    if (existing.authorId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权删除此帖子' },
        { status: 403 }
      );
    }

    // 软删除
    await prisma.post.update({
      where: { id },
      data: { status: 'DELETED' },
    });

    return NextResponse.json({ message: '帖子已删除' });
  } catch (error) {
    console.error('[POST DELETE ERROR]', error);
    return NextResponse.json(
      { error: '删除帖子失败' },
      { status: 500 }
    );
  }
}

// ============ PATCH /api/forum/posts/[id] - 管理操作（置顶/加精） ============
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 管理员鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '无效的帖子 ID' },
        { status: 400 }
      );
    }

    // 检查帖子是否存在
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing || existing.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action } = body;

    // ---- 根据操作类型处理 ----
    if (action === 'pin') {
      // 切换置顶状态
      const post = await prisma.post.update({
        where: { id },
        data: { isPinned: !existing.isPinned },
      });
      return NextResponse.json({
        message: post.isPinned ? '帖子已置顶' : '帖子已取消置顶',
        isPinned: post.isPinned,
      });
    }

    if (action === 'essence') {
      // 切换加精状态
      const post = await prisma.post.update({
        where: { id },
        data: { isEssence: !existing.isEssence },
      });
      return NextResponse.json({
        message: post.isEssence ? '帖子已加精' : '帖子已取消加精',
        isEssence: post.isEssence,
      });
    }

    if (action === 'lock') {
      // 锁定帖子（禁止评论）
      const post = await prisma.post.update({
        where: { id },
        data: { isLocked: true },
      });
      return NextResponse.json({
        message: '帖子已锁定，禁止评论',
        isLocked: post.isLocked,
      });
    }

    if (action === 'unlock') {
      // 解锁帖子
      const post = await prisma.post.update({
        where: { id },
        data: { isLocked: false },
      });
      return NextResponse.json({
        message: '帖子已解锁，可以评论',
        isLocked: post.isLocked,
      });
    }

    return NextResponse.json(
      { error: '不支持的操作，请使用 pin、essence、lock 或 unlock' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[POST PATCH ERROR]', error);
    return NextResponse.json(
      { error: '管理操作失败' },
      { status: 500 }
    );
  }
}
