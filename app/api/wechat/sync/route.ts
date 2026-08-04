import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { logOperation } from '@/lib/admin-log';
import {
  getWechatConfig,
  getWechatAccountType,
  markdownToWechatHtml,
  extractFirstImageFromMarkdown,
  downloadAndUploadThumb,
  getOrCreateDefaultThumbMediaId,
  addDraft,
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

    // 并发查询记录列表、总数、配置状态
    const [total, records, config] = await Promise.all([
      prisma.wechatSync.count(),
      prisma.wechatSync.findMany({
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

// ============ POST /api/wechat/sync - 同步帖子到微信 ============
// body: { postId: string }
// 企业号模式：调用微信 API 创建草稿
// 个人号模式：生成微信格式 HTML，不调用 API，返回内容供手动复制
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { postId } = body;

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
    const htmlContent = markdownToWechatHtml(post.content);
    const digest = post.content
      .replace(/[#*`>\-\[\]!()]/g, '')
      .replace(/\n+/g, ' ')
      .trim()
      .slice(0, 120);

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
            title: post.title.slice(0, 64),
            content: htmlContent,
            digest: digest || '',
            author: post.authorName || 'Gitd 社区',
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
      title: post.title.slice(0, 64),
      content: htmlContent,
      thumbMediaId,
      digest: digest || undefined,
      author: 'Gitd 社区',
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
