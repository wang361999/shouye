import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { logOperation } from '@/lib/admin-log';
import { publishDraft } from '@/lib/wechat';

// ============ POST /api/wechat/publish - 发布草稿到公众号 ============
// body: { syncId: string }
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { syncId } = body;

    if (!syncId || typeof syncId !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的同步记录 ID' },
        { status: 400 },
      );
    }

    // 查询同步记录
    const record = await prisma.wechatSync.findUnique({
      where: { id: syncId },
      include: {
        post: { select: { title: true } },
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: '同步记录不存在' },
        { status: 404 },
      );
    }

    // 只有草稿状态才能发布
    if (record.status !== 'draft') {
      return NextResponse.json(
        {
          error: `当前状态为「${record.status}」，仅草稿状态可发布`,
        },
        { status: 400 },
      );
    }

    if (!record.mediaId) {
      return NextResponse.json(
        { error: '草稿缺少 media_id，无法发布' },
        { status: 400 },
      );
    }

    // 提交发布
    const publishResult = await publishDraft(record.mediaId);

    if (!publishResult.success || !publishResult.publishId) {
      // 发布失败，更新记录状态
      await prisma.wechatSync.update({
        where: { id: syncId },
        data: {
          status: 'failed',
          errorMessage: publishResult.message,
        },
      });

      return NextResponse.json(
        { error: publishResult.message || '发布失败' },
        { status: 500 },
      );
    }

    // 发布成功，更新记录
    await prisma.wechatSync.update({
      where: { id: syncId },
      data: {
        status: 'published',
        publishId: publishResult.publishId,
        publishedAt: new Date(),
        errorMessage: null,
      },
    });

    // 记录操作日志
    await logOperation(
      admin.userId,
      admin.username,
      'wechat_publish',
      'WechatSync',
      `发布微信草稿到公众号: ${record.post?.title || record.postId}`,
    );

    return NextResponse.json({
      message: '已发布到公众号',
      publishId: publishResult.publishId,
    });
  } catch (error) {
    console.error('[WECHAT PUBLISH ERROR]', error);
    return NextResponse.json(
      { error: '发布到公众号失败' },
      { status: 500 },
    );
  }
}
