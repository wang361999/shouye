import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDb, queryWithTimeout } from '@/lib/db';
import { checkDbOr503 } from '@/lib/db-check';
import { getUserFromRequest, adminAuth } from '@/lib/auth';
import { sendNotification } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import { revalidateCommunityHome } from '@/lib/revalidate';

const QUERY_TIMEOUT = 6000;

// ============ 简单敏感词列表 ============
const SENSITIVE_WORDS = [
  '赌博', '色情', '诈骗', '传销', '代开发票', '假币', '毒品',
  '枪支', '办证', '套现', '刷单', '兼职群', '加微信',
];

// ============ 敏感词检测函数 ============
function containsSensitiveWord(text: string): boolean {
  return SENSITIVE_WORDS.some((word) => text.includes(word));
}

// ============ HTML 转义函数（防止邮件内容 XSS） ============
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============ GET /api/forum/comments - 获取评论列表 ============
// 模式1: ?postId=xxx - 获取指定帖子评论树（前台用）
// 模式2: ?approved=true|false|all - 管理后台查询评论（需管理员权限）
//        - approved=true: 已通过审核
//        - approved=false: 待审核
//        - approved=all: 全部评论
//        可附加 ?postId=&search=&page=&limit= 进行筛选
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const approved = searchParams.get('approved');

    // ---- 模式1：按 postId 查询帖子评论树 ----
    // 使用原生 SQL 替代 Prisma，通过并行查询获取评论+作者+回复
    if (postId && approved === null) {
      let db;
      const dbError = checkDbOr503();
      if (dbError) return dbError;
      try {
        db = getDb();
      } catch {
        return NextResponse.json([]);
      }

      // 1. 查询顶级评论 + 作者
      const commentRows = await queryWithTimeout(
        db,
        `SELECT cm.id, cm.content, cm.post_id, cm.parent_id,
                cm.like_count, cm.is_approved, cm.is_accepted,
                cm.deleted_at, cm.created_at, cm.updated_at,
                u.id as author_id, u.username as author_username, u.avatar as author_avatar
         FROM Comment cm
         LEFT JOIN User u ON cm.author_id = u.id
         WHERE cm.post_id = ? AND cm.parent_id IS NULL AND cm.deleted_at IS NULL
         ORDER BY cm.created_at DESC`,
        [postId],
        QUERY_TIMEOUT,
      );

      const comments = commentRows as Record<string, unknown>[];

      // 2. 查询回复 + 作者（如果有顶级评论）
      let repliesMap: Map<string, Record<string, unknown>[]> = new Map();

      if (comments.length > 0) {
        const commentIds = comments.map((c) => c.id as string);
        const placeholders = commentIds.map(() => '?').join(',');
        const replyRows = await queryWithTimeout(
          db,
          `SELECT cm.id, cm.content, cm.post_id, cm.parent_id,
                  cm.like_count, cm.is_approved, cm.is_accepted,
                  cm.deleted_at, cm.created_at, cm.updated_at,
                  u.id as author_id, u.username as author_username, u.avatar as author_avatar
           FROM Comment cm
           LEFT JOIN User u ON cm.author_id = u.id
           WHERE cm.parent_id IN (${placeholders}) AND cm.deleted_at IS NULL
           ORDER BY cm.created_at ASC`,
          commentIds,
          QUERY_TIMEOUT,
        );

        repliesMap = new Map();
        for (const reply of replyRows as Record<string, unknown>[]) {
          const parentId = reply.parent_id as string;
          if (!repliesMap.has(parentId)) repliesMap.set(parentId, []);
          repliesMap.get(parentId)!.push(reply);
        }
      }

      // 3. 组装嵌套结构（保持与 Prisma 响应格式一致）
      const formatComment = (c: Record<string, unknown>) => ({
        id: c.id,
        content: c.content,
        postId: c.post_id,
        authorId: c.author_id,
        parentId: c.parent_id,
        likeCount: Number(c.like_count) || 0,
        isApproved: Boolean(c.is_approved),
        isAccepted: Boolean(c.is_accepted),
        deletedAt: c.deleted_at,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        author: {
          id: c.author_id || '',
          username: c.author_username || '匿名',
          avatar: c.author_avatar || null,
        },
      });

      const result = comments.map((c) => ({
        ...formatComment(c),
        replies: (repliesMap.get(c.id as string) || []).map(formatComment),
      }));

      return NextResponse.json(result);
    }

    // ---- 模式2：管理后台查询评论列表 ----
    if (approved === 'false' || approved === 'true' || approved === 'all') {
      // admin 鉴权
      const admin = adminAuth(request);
      if (admin instanceof Response) return admin;

      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '20', 10);
      const search = searchParams.get('search') || undefined;

      const where: Record<string, unknown> = {
        deletedAt: null,
      };

      // 按审核状态筛选
      if (approved === 'true' || approved === 'false') {
        where.isApproved = approved === 'true';
      }

      // 按帖子筛选
      if (postId) {
        where.postId = postId;
      }

      // 关键词搜索（评论内容）
      if (search) {
        where.content = { contains: search };
      }

      const [total, comments] = await Promise.all([
        prisma.comment.count({ where }),
        prisma.comment.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            post: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return NextResponse.json({
        data: comments,
        total,
        page,
        totalPages,
      });
    }

    return NextResponse.json(
      { error: '缺少查询参数，需要 postId 或 approved' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[COMMENTS LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取评论列表失败' },
      { status: 500 }
    );
  }
}

// ============ PATCH /api/forum/comments - 审核评论（管理员） ============
// body: { commentId, action: 'approve' }
export async function PATCH(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { commentId, action } = body;

    if (!commentId) {
      return NextResponse.json(
        { error: '缺少评论 ID' },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });

    if (!comment) {
      return NextResponse.json(
        { error: '评论不存在' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      const updated = await prisma.comment.update({
        where: { id: commentId },
        data: { isApproved: true },
      });

      // 如果之前未通过审核，现在通过，则帖子评论数 +1
      if (!comment.isApproved) {
        await prisma.post.update({
          where: { id: comment.postId },
          data: { commentCount: { increment: 1 } },
        });
      }

      return NextResponse.json({
        message: '评论已通过审核',
        isApproved: updated.isApproved,
      });
    }

    return NextResponse.json(
      { error: '不支持的操作，请使用 approve' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[COMMENT PATCH ERROR]', error);
    return NextResponse.json(
      { error: '审核操作失败' },
      { status: 500 }
    );
  }
}

// ============ POST /api/forum/comments - 发表评论 ============
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
    const { content, postId, parentId } = body;

    // ---- 输入校验 ----
    if (!content || !postId) {
      return NextResponse.json(
        { error: '评论内容和帖子 ID 不能为空' },
        { status: 400 }
      );
    }

    if (!content.trim()) {
      return NextResponse.json(
        { error: '评论内容不能为空白' },
        { status: 400 }
      );
    }

    // 检查帖子是否存在
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post || post.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在' },
        { status: 404 }
      );
    }

    // 检查帖子是否被锁定（管理员可评论）
    if (post.isLocked && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '帖子已锁定，禁止评论' },
        { status: 403 }
      );
    }

    // 如果指定了父评论，验证父评论是否存在且属于同一帖子
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
      });
      if (!parentComment || parentComment.postId !== postId) {
        return NextResponse.json(
          { error: '父评论不存在或不属于该帖子' },
          { status: 400 }
        );
      }
    }

    // ---- 自动审核：简单敏感词过滤，命中则 isApproved=false ----
    const isApproved = !containsSensitiveWord(content.trim());

    // ---- 创建评论 ----
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        postId,
        authorId: user.userId,
        parentId: parentId || null,
        isApproved,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // 只有审核通过的评论才计入帖子评论数
    if (isApproved) {
      await prisma.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });
    }

    // 刷新社区首页缓存，使最新评论数立即反映在首页
    revalidateCommunityHome();

    // ---- 通知帖子作者有新回复（评论者不是作者时） ----
    if (user.userId !== post.authorId) {
      const commentSummary =
        content.trim().length > 50
          ? `${content.trim().slice(0, 50)}...`
          : content.trim();

      // 站内通知
      await sendNotification({
        userId: post.authorId,
        type: 'reply',
        title: '您的帖子有新回复',
        content: `${user.username || '匿名用户'} 回复了您：${commentSummary}`,
        link: `/forum/post/${postId}`,
      });

      // 邮件通知（发送失败不影响评论创建，静默处理）
      try {
        // 查询帖子作者和评论者的邮箱与用户名
        const users = await prisma.user.findMany({
          where: { id: { in: [post.authorId, user.userId] } },
          select: { id: true, email: true, username: true },
        });
        const postAuthor = users.find((u) => u.id === post.authorId);
        const commentAuthorInfo = users.find((u) => u.id === user.userId);

        // 仅当帖子作者有邮箱时发送邮件
        if (postAuthor?.email) {
          // 从数据库读取 Resend 邮件配置
          const settings = await prisma.systemSetting.findMany({
            where: { key: { in: ['resend_api_key', 'resend_from_email'] } },
          });
          const mailConfig: Record<string, string> = {};
          for (const s of settings) mailConfig[s.key] = s.value;

          const commenterName =
            commentAuthorInfo?.username || user.username || '匿名用户';
          const authorName = postAuthor.username || '社区成员';
          const postTitle = post.title;
          const rawContent = content.trim();
          const commentExcerpt =
            rawContent.length > 200
              ? `${rawContent.slice(0, 200)}...`
              : rawContent;
          const origin = new URL(request.url).origin;
          const postLink = `${origin}/forum/post/${postId}`;

          const html = `
            <div style="max-width:600px;margin:0 auto;padding:0;font-family:Arial,'Microsoft YaHei',Helvetica,sans-serif;background-color:#f4f5f7;">
              <!-- 顶部品牌标题 -->
              <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 24px;text-align:center;border-radius:8px 8px 0 0;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">Gitd 社区</h1>
                <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">有人回复了你的帖子</p>
              </div>

              <!-- 正文通知内容 -->
              <div style="background:#ffffff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;">
                <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">
                  你好，${escapeHtml(authorName)}：
                </p>
                <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.7;">
                  <strong style="color:#4f46e5;">${escapeHtml(commenterName)}</strong> 回复了你的帖子
                  <a href="${escapeHtml(postLink)}" style="color:#4f46e5;text-decoration:none;">《${escapeHtml(postTitle)}》</a>
                </p>

                <!-- 评论摘要 -->
                <div style="background:#f9fafb;border-left:3px solid #4f46e5;padding:14px 16px;margin:0 0 24px;border-radius:0 4px 4px 0;">
                  <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">评论内容</p>
                  <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word;">${escapeHtml(commentExcerpt)}</p>
                </div>

                <!-- 查看详情按钮 -->
                <div style="text-align:center;margin:0 0 8px;">
                  <a href="${escapeHtml(postLink)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:6px;">查看详情并回复</a>
                </div>
              </div>

              <!-- 底部版权信息 -->
              <div style="background:#f9fafb;padding:20px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;text-align:center;">
                <p style="margin:0 0 4px;color:#9ca3af;font-size:12px;">
                  此邮件由 Gitd 社区自动发送，请勿直接回复。
                </p>
                <p style="margin:0;color:#9ca3af;font-size:12px;">
                  &copy; ${new Date().getFullYear()} Gitd. 保留所有权利。
                </p>
              </div>
            </div>
          `;

          await sendEmail(
            {
              to: postAuthor.email,
              subject: `[Gitd] ${commenterName} 回复了你的帖子《${postTitle}》`,
              html,
            },
            mailConfig,
            'Gitd',
          );
        }
      } catch (emailError) {
        // 邮件发送失败不影响评论创建，静默处理
        console.error('[COMMENT EMAIL NOTIFY ERROR]', emailError);
      }
    }

    // 如果评论被标记为待审核，返回提示信息
    if (!isApproved) {
      return NextResponse.json(
        {
          ...comment,
          message: '评论包含敏感内容，已提交待审核',
        },
        { status: 201 }
      );
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('[COMMENT CREATE ERROR]', error);
    return NextResponse.json(
      { error: '发表评论失败' },
      { status: 500 }
    );
  }
}

// ============ DELETE /api/forum/comments - 删除评论 ============
// 通过 body.commentId 指定要删除的评论，合并到同一文件节省函数名额
export async function DELETE(request: NextRequest) {
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
    const { commentId } = body;

    // ---- 输入校验 ----
    if (!commentId) {
      return NextResponse.json(
        { error: '缺少评论 ID' },
        { status: 400 }
      );
    }

    // 检查评论是否存在（排除已软删除的）
    const comment = await prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
    });

    if (!comment) {
      return NextResponse.json(
        { error: '评论不存在' },
        { status: 404 }
      );
    }

    // 权限检查：评论作者本人或管理员
    if (comment.authorId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权删除此评论' },
        { status: 403 }
      );
    }

    // 检查是否有未删除的子评论
    const repliesCount = await prisma.comment.count({
      where: { parentId: commentId, deletedAt: null },
    });

    if (repliesCount > 0) {
      return NextResponse.json(
        { error: '该评论下还有回复，无法删除。请先删除所有回复' },
        { status: 400 }
      );
    }

    // ---- 软删除评论（设置 deletedAt） ----
    await prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    // 仅审核通过的评论才更新帖子评论数 -1
    if (comment.isApproved) {
      await prisma.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      });
    }

    return NextResponse.json({ message: '评论已删除' });
  } catch (error) {
    console.error('[COMMENT DELETE ERROR]', error);
    return NextResponse.json(
      { error: '删除评论失败' },
      { status: 500 }
    );
  }
}
