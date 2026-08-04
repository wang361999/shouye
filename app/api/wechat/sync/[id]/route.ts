import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { logOperation } from '@/lib/admin-log';
import { deleteDraft } from '@/lib/wechat';

// ============ DELETE /api/wechat/sync/[id] - 删除微信草稿 ============
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: '无效的同步记录 ID' },
        { status: 400 },
      );
    }

    // 查询同步记录
    const record = await prisma.wechatSync.findUnique({
      where: { id },
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

    // 只有草稿状态才能删除
    if (record.status !== 'draft') {
      return NextResponse.json(
        {
          error: `当前状态为「${record.status}」，仅草稿状态可删除`,
        },
        { status: 400 },
      );
    }

    // 如果有 media_id，调用微信 API 删除草稿
    if (record.mediaId) {
      const deleteResult = await deleteDraft(record.mediaId);
      if (!deleteResult.success) {
        // 微信端删除失败，记录警告但仍更新本地状态
        console.warn(
          '[WECHAT SYNC DELETE] 微信端草稿删除失败:',
          deleteResult.message,
        );
      }
    }

    // 更新本地记录状态为 deleted
    await prisma.wechatSync.update({
      where: { id },
      data: { status: 'deleted' },
    });

    // 记录操作日志
    await logOperation(
      admin.userId,
      admin.username,
      'wechat_sync_delete',
      'WechatSync',
      `删除微信草稿: ${record.post?.title || record.postId}`,
    );

    return NextResponse.json({ message: '草稿已删除' });
  } catch (error) {
    console.error('[WECHAT SYNC DELETE ERROR]', error);
    return NextResponse.json(
      { error: '删除草稿失败' },
      { status: 500 },
    );
  }
}
