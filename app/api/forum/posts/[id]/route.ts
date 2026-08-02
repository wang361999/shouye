import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDb, queryWithTimeout, checkDbOr503 } from '@/lib/db';
import { getUserFromRequest, adminAuth } from '@/lib/auth';
import { revalidateCommunityHome } from '@/lib/revalidate';

const QUERY_TIMEOUT = 6000;

// ============ GET /api/forum/posts/[id] - 获取帖子详情 ============
// 使用原生 SQL 替代 Prisma，通过并行查询获取帖子+作者+分类+标签+评论
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '无效的帖子 ID' },
        { status: 400 },
      );
    }

    let db;
    const dbError = checkDbOr503();
    if (dbError) return dbError;
    try {
      db = getDb();
    } catch {
      return NextResponse.json(
        { error: '数据库连接失败' },
        { status: 503 },
      );
    }

    // ---- 1. 查询帖子 + 作者 + 分类（单次 JOIN 查询）----
    const postRows = await queryWithTimeout(
      db,
      `SELECT p.id, p.title, p.content, p.category_id,
              p.view_count, p.like_count, p.comment_count,
              p.is_pinned, p.is_essence, p.is_locked, p.status,
              p.post_type, p.accepted_comment_id, p.author_name,
              p.deleted_at, p.created_at, p.updated_at,
              u.id as author_id, u.username as author_username, u.avatar as author_avatar,
              c.id as cat_id, c.name as cat_name, c.slug as cat_slug
       FROM Post p
       LEFT JOIN User u ON p.author_id = u.id
       LEFT JOIN Category c ON p.category_id = c.id
       WHERE p.id = ?`,
      [id],
      QUERY_TIMEOUT,
      [],
    );

    const postRow = (postRows as Record<string, unknown>[])[0];

    if (!postRow || postRow.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在' },
        { status: 404 },
      );
    }

    // ---- 2. 并行查询：标签 + 顶级评论 + 浏览量+1 + 采纳评论 ----
    const [tagRows, commentRows] = await Promise.all([
      queryWithTimeout(
        db,
        `SELECT t.id as tag_id, t.name as tag_name, t.slug as tag_slug
         FROM PostTag pt
         JOIN Tag t ON pt.tag_id = t.id
         WHERE pt.post_id = ?`,
        [id],
        QUERY_TIMEOUT,
        [],
      ),
      queryWithTimeout(
        db,
        `SELECT cm.id, cm.content, cm.post_id, cm.parent_id,
                cm.like_count, cm.is_approved, cm.is_accepted,
                cm.deleted_at, cm.created_at, cm.updated_at,
                u.id as author_id, u.username as author_username, u.avatar as author_avatar
         FROM Comment cm
         LEFT JOIN User u ON cm.author_id = u.id
         WHERE cm.post_id = ? AND cm.parent_id IS NULL
         ORDER BY cm.created_at DESC
         LIMIT 10`,
        [id],
        QUERY_TIMEOUT,
        [],
      ),
    ]);

    // 浏览量 +1（异步执行，不阻塞响应）
    db.execute({
      sql: 'UPDATE Post SET view_count = view_count + 1 WHERE id = ?',
      args: [id],
    }).catch(() => {
      // 忽略浏览量更新失败
    });

    // ---- 3. 查询评论的回复 ----
    const comments = commentRows as Record<string, unknown>[];
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
         WHERE cm.parent_id IN (${placeholders})
         ORDER BY cm.created_at ASC`,
        commentIds,
        QUERY_TIMEOUT,
        [],
      );

      repliesMap = new Map();
      for (const reply of replyRows as Record<string, unknown>[]) {
        const parentId = reply.parent_id as string;
        if (!repliesMap.has(parentId)) repliesMap.set(parentId, []);
        repliesMap.get(parentId)!.push(reply);
      }
    }

    // ---- 4. 查询采纳评论（如果存在）----
    const acceptedCommentId = postRow.accepted_comment_id as string | null;
    let acceptedComment = null;

    if (acceptedCommentId) {
      const acceptedRows = await queryWithTimeout(
        db,
        `SELECT cm.id, cm.content, cm.is_accepted, cm.created_at,
                u.id as author_id, u.username as author_username, u.avatar as author_avatar
         FROM Comment cm
         LEFT JOIN User u ON cm.author_id = u.id
         WHERE cm.id = ?`,
        [acceptedCommentId],
        QUERY_TIMEOUT,
        [],
      );

      const ac = (acceptedRows as Record<string, unknown>[])[0];
      if (ac) {
        acceptedComment = {
          id: ac.id,
          content: ac.content,
          isAccepted: Boolean(ac.is_accepted),
          createdAt: ac.created_at,
          author: {
            id: ac.author_id || '',
            username: ac.author_username || '匿名',
            avatar: ac.author_avatar || null,
          },
        };
      }
    }

    // ---- 5. 组装返回数据（保持与 Prisma 响应格式一致）----
    const authorObj = {
      id: postRow.author_id || '',
      username: postRow.author_username || '匿名',
      avatar: postRow.author_avatar || null,
    };

    // 如果设置了自定义作者名，覆盖 author.username 用于前端显示
    const finalAuthor = postRow.author_name
      ? { ...authorObj, username: postRow.author_name as string }
      : authorObj;

    const tags = (tagRows as Record<string, unknown>[]).map((t) => ({
      tag: {
        id: t.tag_id,
        name: t.tag_name,
        slug: t.tag_slug,
      },
    }));

    const commentsWithReplies = comments.map((c) => {
      const commentAuthor = {
        id: c.author_id || '',
        username: c.author_username || '匿名',
        avatar: c.author_avatar || null,
      };
      const replies = (repliesMap.get(c.id as string) || []).map((r) => ({
        id: r.id,
        content: r.content,
        postId: r.post_id,
        authorId: r.author_id,
        parentId: r.parent_id,
        likeCount: Number(r.like_count) || 0,
        isApproved: Boolean(r.is_approved),
        isAccepted: Boolean(r.is_accepted),
        deletedAt: r.deleted_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        author: {
          id: r.author_id || '',
          username: r.author_username || '匿名',
          avatar: r.author_avatar || null,
        },
      }));

      return {
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
        author: commentAuthor,
        replies,
      };
    });

    const response = {
      id: postRow.id,
      title: postRow.title,
      content: postRow.content,
      categoryId: postRow.category_id,
      authorId: postRow.author_id,
      viewCount: Number(postRow.view_count) + 1, // 返回更新后的浏览量
      likeCount: Number(postRow.like_count) || 0,
      commentCount: Number(postRow.comment_count) || 0,
      isPinned: Boolean(postRow.is_pinned),
      isEssence: Boolean(postRow.is_essence),
      isLocked: Boolean(postRow.is_locked),
      status: postRow.status,
      postType: postRow.post_type,
      acceptedCommentId: postRow.accepted_comment_id,
      authorName: postRow.author_name,
      deletedAt: postRow.deleted_at,
      createdAt: postRow.created_at,
      updatedAt: postRow.updated_at,
      author: finalAuthor,
      category: postRow.cat_id
        ? {
            id: postRow.cat_id,
            name: postRow.cat_name,
            slug: postRow.cat_slug,
          }
        : null,
      tags,
      comments: commentsWithReplies,
      acceptedComment,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST DETAIL ERROR]', error);
    return NextResponse.json(
      { error: '获取帖子详情失败' },
      { status: 500 },
    );
  }
}

// ============ PUT /api/forum/posts/[id] - 编辑帖子 ============
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // 登录鉴权
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
        { error: '无效的帖子 ID' },
        { status: 400 },
      );
    }

    // 检查帖子是否存在
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing || existing.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在' },
        { status: 404 },
      );
    }

    // 权限检查：作者本人或管理员
    if (existing.authorId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权编辑此帖子' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { title, content, categoryId, tags, postType: rawPostType } = body;

    // ---- 输入校验 ----
    if (!title || !content) {
      return NextResponse.json(
        { error: '标题和内容不能为空' },
        { status: 400 },
      );
    }

    if (title.length > 100) {
      return NextResponse.json(
        { error: '标题不能超过 100 个字符' },
        { status: 400 },
      );
    }

    // 帖子类型校验：仅允许 discussion | question
    let postType: string | undefined;
    if (rawPostType !== undefined) {
      postType = rawPostType === 'question' ? 'question' : 'discussion';
    }

    // 标签处理：仅当传入 tags 字段时才更新（先删除旧 PostTag，再创建新的）
    let tagEntries: { name: string; slug: string }[] | null = null;
    if (tags !== undefined && tags !== null) {
      if (!Array.isArray(tags)) {
        return NextResponse.json(
          { error: '标签必须为字符串数组' },
          { status: 400 },
        );
      }
      tagEntries = [];
      const seenSlugs = new Set<string>();
      for (const raw of tags) {
        const name = String(raw).trim();
        if (!name) continue;
        const slug = name.toLowerCase().replace(/\s+/g, '-');
        // 按 slug 去重，避免 PostTag 主键冲突
        if (seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);
        tagEntries.push({ name, slug });
        if (tagEntries.length >= 5) break;
      }
    }

    // ---- 更新帖子（含标签替换时使用事务保证一致性）----
    const post = await prisma.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: { id },
        data: {
          title,
          content,
          ...(categoryId !== undefined && { categoryId: categoryId || null }),
          ...(postType !== undefined && { postType }),
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
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      // 仅当传入 tags 字段时替换标签关联
      if (tagEntries) {
        // 获取旧标签 ID，用于后续 postCount 递减
        const oldPostTags = await tx.postTag.findMany({
          where: { postId: id },
          select: { tagId: true },
        });
        const oldTagIds = oldPostTags.map((pt) => pt.tagId);

        // 先删除旧 PostTag
        await tx.postTag.deleteMany({ where: { postId: id } });

        // 旧标签 postCount -1（防止负数）
        if (oldTagIds.length > 0) {
          await tx.tag.updateMany({
            where: { id: { in: oldTagIds }, postCount: { gt: 0 } },
            data: { postCount: { decrement: 1 } },
          });
        }

        // 再创建新的 PostTag 关联
        for (const { name, slug } of tagEntries) {
          const tag = await tx.tag.upsert({
            where: { slug },
            update: { postCount: { increment: 1 } },
            create: { name, slug, postCount: 1 },
          });
          await tx.postTag.create({
            data: { postId: id, tagId: tag.id },
          });
        }
      }

      return updated;
    });

    return NextResponse.json(post);
  } catch (error) {
    console.error('[POST UPDATE ERROR]', error);
    return NextResponse.json(
      { error: '编辑帖子失败' },
      { status: 500 },
    );
  }
}

// ============ DELETE /api/forum/posts/[id] - 删除帖子（软删除） ============
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // 登录鉴权
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
        { error: '无效的帖子 ID' },
        { status: 400 },
      );
    }

    // 检查帖子是否存在
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing || existing.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在' },
        { status: 404 },
      );
    }

    // 权限检查：作者本人或管理员
    if (existing.authorId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权删除此帖子' },
        { status: 403 },
      );
    }

    // 软删除
    await prisma.post.update({
      where: { id },
      data: { status: 'DELETED' },
    });

    // 清除社区首页缓存，避免删除后前端仍展示该帖子
    revalidateCommunityHome();

    return NextResponse.json({ message: '帖子已删除' });
  } catch (error) {
    console.error('[POST DELETE ERROR]', error);
    return NextResponse.json(
      { error: '删除帖子失败' },
      { status: 500 },
    );
  }
}

// ============ PATCH /api/forum/posts/[id] - 管理操作（置顶/加精） ============
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // 管理员鉴权
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: '无效的帖子 ID' },
        { status: 400 },
      );
    }

    // 检查帖子是否存在
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing || existing.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在' },
        { status: 404 },
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

    if (action === 'setCategory') {
      // 更新帖子分类（用于自动分类功能）
      const { categoryId } = body;
      const post = await prisma.post.update({
        where: { id },
        data: { categoryId: categoryId || null },
      });
      return NextResponse.json({
        message: '帖子分类已更新',
        categoryId: post.categoryId,
      });
    }

    return NextResponse.json(
      { error: '不支持的操作，请使用 pin、essence、lock、unlock 或 setCategory' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[POST PATCH ERROR]', error);
    return NextResponse.json(
      { error: '管理操作失败' },
      { status: 500 },
    );
  }
}
