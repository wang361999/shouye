import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { logOperation } from '@/lib/admin-log';
import {
  getWechatConfig,
  getWechatAccountType,
  buildWechatDigest,
  buildWechatArticleHtml,
  markdownToWechatHtml,
  normalizeWechatTemplate,
  extractFirstImageFromMarkdown,
  downloadAndUploadThumb,
  getOrCreateDefaultThumbMediaId,
  addDraft,
  deleteDraft,
} from '@/lib/wechat';

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;

// ============ GET /api/wechat/sync - 获取同步记录列表 ============
// 支持 ?page=1&limit=20 分页
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      PAGE_SIZE_MAX,
      parseInt(searchParams.get('limit') || String(PAGE_SIZE_DEFAULT), 10),
    );

    const where = { status: { not: 'deleted' } };

    // 并发查询记录列表、总数、配置状态
    const [total, records, config] = await Promise.all([
      prisma.wechatSync.count({ where }),
      prisma.wechatSync.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          post: {
            select: { id: true, title: true },
          },
          user: {
            select: { id: true, username: true },
          },
        },
      }),
      getWechatConfig(),
    ]);

    return NextResponse.json({
      records: records.map((r) => ({
        id: r.id,
        postId: r.postId,
        postTitle: r.post?.title || '(帖子已删除)',
        status: r.status,
        syncedBy: r.user
          ? { id: r.user.id, username: r.user.username }
          : null,
        createdAt: r.createdAt.toISOString(),
        errorMessage: r.errorMessage,
        wechatMediaId: r.mediaId,
      })),
      total,
      totalPages: Math.ceil(total / limit),
      page,
      config,
    });
  } catch (error) {
    console.error('[WECHAT SYNC LIST ERROR]', error);
    return NextResponse.json(
      { error: '获取同步记录失败' },
      { status: 500 },
    );
  }
}

// ============ DELETE /api/wechat/sync - 一键清除可删除记录 ============
// 清除范围：draft / failed / generated
// - draft：如存在微信草稿 media_id，尽量调用微信 API 删除远端草稿
// - failed/generated：只清除本地记录状态
export async function DELETE(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const records = await prisma.wechatSync.findMany({
      where: {
        status: { in: ['draft', 'failed', 'generated'] },
      },
      include: {
        post: { select: { title: true } },
      },
    });

    if (records.length === 0) {
      return NextResponse.json({
        message: '没有可清除的记录',
        clearedCount: 0,
        remoteDeleteFailedCount: 0,
      });
    }

    let remoteDeleteFailedCount = 0;
    const draftRecords = records.filter((record) => record.status === 'draft' && record.mediaId);

    for (const record of draftRecords) {
      const deleteResult = await deleteDraft(record.mediaId as string);
      if (!deleteResult.success) {
        remoteDeleteFailedCount += 1;
        console.warn(
          '[WECHAT SYNC CLEAR] 微信端草稿删除失败:',
          record.id,
          deleteResult.message,
        );
      }
    }

    const updateResult = await prisma.wechatSync.updateMany({
      where: {
        id: { in: records.map((record) => record.id) },
      },
      data: { status: 'deleted' },
    });

    await logOperation(
      admin.userId,
      admin.username,
      'wechat_sync_clear',
      'WechatSync',
      `一键清除公众号同步/生成记录: ${updateResult.count} 条`,
    );

    return NextResponse.json({
      message:
        remoteDeleteFailedCount > 0
          ? `已清除 ${updateResult.count} 条记录，其中 ${remoteDeleteFailedCount} 个微信端草稿删除失败，本地记录已清除`
          : `已清除 ${updateResult.count} 条记录`,
      clearedCount: updateResult.count,
      remoteDeleteFailedCount,
    });
  } catch (error) {
    console.error('[WECHAT SYNC CLEAR ERROR]', error);
    return NextResponse.json(
      { error: '清除记录失败' },
      { status: 500 },
    );
  }
}

// ============ POST /api/wechat/sync - 同步帖子到微信 ============
// body: { postId: string, template?: 'technical' | 'open-source' }
// 企业号模式：调用微信 API 创建草稿
// 个人号模式：生成微信格式 HTML，不调用 API，返回内容供手动复制
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { postId } = body;
    const template = normalizeWechatTemplate(body.template);

    if (!postId || typeof postId !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的帖子 ID' },
        { status: 400 },
      );
    }

    // ---- 1. 检查微信配置 ----
    const config = await getWechatConfig();
    if (!config.configured) {
      return NextResponse.json(
        { error: '微信公众号未配置，请先在系统设置中配置 AppID 与 Secret' },
        { status: 400 },
      );
    }

    // ---- 2. 查询帖子 ----
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
        authorId: true,
        authorName: true,
      },
    });

    if (!post || post.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在或已删除' },
        { status: 404 },
      );
    }

    // ---- 3. 转换 Markdown 为微信 HTML ----
    const digest = buildWechatDigest(post.content);
    const title = post.title.slice(0, 64);
    const author = post.authorName || 'Gitd 社区';
    const htmlContent = markdownToWechatHtml(post.content, template);
    const fullContent = buildWechatArticleHtml({
      title,
      content: htmlContent,
      digest: digest || '',
      author,
    }, template);

    // ---- 4. 判断账号类型，走不同流程 ----
    const accountType = await getWechatAccountType();

    if (accountType === 'personal') {
      // ===== 个人号模式：不调用微信 API，仅生成内容 =====
      const syncRecord = await prisma.wechatSync.create({
        data: {
          postId: post.id,
          mediaId: 'manual',
          status: 'generated',
          syncedBy: admin.userId,
        },
        include: {
          post: { select: { id: true, title: true } },
          user: { select: { id: true, username: true } },
        },
      });

      await logOperation(
        admin.userId,
        admin.username,
        'wechat_sync',
        'Post',
        `生成微信内容（个人号模式）: ${post.title}`,
      );

      return NextResponse.json(
        {
          message: '内容已生成，请复制到微信公众号后台手动发布',
          record: {
            id: syncRecord.id,
            postId: syncRecord.postId,
            postTitle: syncRecord.post?.title || '',
            status: syncRecord.status,
            wechatMediaId: syncRecord.mediaId,
            syncedBy: syncRecord.user
              ? { id: syncRecord.user.id, username: syncRecord.user.username }
              : null,
            createdAt: syncRecord.createdAt.toISOString(),
          },
          // 个人号模式直接返回生成的内容
          preview: {
            title,
            content: htmlContent,
            fullContent,
            digest: digest || '',
            author,
            template,
          },
        },
        { status: 201 },
      );
    }

    // ===== 企业号模式：调用微信 API 创建草稿 =====
    // ---- 5. 处理封面缩略图 ----
    let thumbMediaId: string;
    const firstImage = extractFirstImageFromMarkdown(post.content);

    if (firstImage) {
      const thumbResult = await downloadAndUploadThumb(firstImage);
      if (thumbResult.success && thumbResult.mediaId) {
        thumbMediaId = thumbResult.mediaId;
      } else {
        console.warn('[WECHAT SYNC] 封面图片上传失败，使用默认封面:', thumbResult.message);
        thumbMediaId = await getOrCreateDefaultThumbMediaId();
      }
    } else {
      thumbMediaId = await getOrCreateDefaultThumbMediaId();
    }

    // ---- 6. 提交草稿到微信 ----
    const draftResult = await addDraft({
      title,
      content: fullContent,
      thumbMediaId,
      digest: digest || undefined,
      author,
    });

    if (!draftResult.success || !draftResult.mediaId) {
      await prisma.wechatSync.create({
        data: {
          postId: post.id,
          mediaId: null,
          status: 'failed',
          errorMessage: draftResult.message,
          syncedBy: admin.userId,
        },
      });

      return NextResponse.json(
        { error: draftResult.message || '同步到微信草稿箱失败' },
        { status: 500 },
      );
    }

    // ---- 7. 创建同步记录 ----
    const syncRecord = await prisma.wechatSync.create({
      data: {
        postId: post.id,
        mediaId: draftResult.mediaId,
        status: 'draft',
        syncedBy: admin.userId,
      },
      include: {
        post: { select: { id: true, title: true } },
        user: { select: { id: true, username: true } },
      },
    });

    await logOperation(
      admin.userId,
      admin.username,
      'wechat_sync',
      'Post',
      `同步帖子到微信公众号草稿箱: ${post.title}`,
    );

    return NextResponse.json(
      {
        message: '已同步到微信草稿箱',
        record: {
          id: syncRecord.id,
          postId: syncRecord.postId,
          postTitle: syncRecord.post?.title || '',
          status: syncRecord.status,
          wechatMediaId: syncRecord.mediaId,
          syncedBy: syncRecord.user
            ? { id: syncRecord.user.id, username: syncRecord.user.username }
            : null,
          createdAt: syncRecord.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[WECHAT SYNC CREATE ERROR]', error);
    const message =
      error instanceof Error ? error.message : '同步到微信失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
