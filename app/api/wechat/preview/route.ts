import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { markdownToWechatHtml } from '@/lib/wechat';

// ============ POST /api/wechat/preview - 生成微信格式 HTML（个人号模式） ============
// body: { postId: string }
// 不调用微信 API，仅将帖子 Markdown 转为微信公众号适配的 HTML 返回给前端
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

    // 查询帖子
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
        authorName: true,
      },
    });

    if (!post || post.status === 'DELETED') {
      return NextResponse.json(
        { error: '帖子不存在或已删除' },
        { status: 404 },
      );
    }

    // 转换 Markdown 为微信 HTML
    const htmlContent = markdownToWechatHtml(post.content);

    // 生成摘要
    const digest = post.content
      .replace(/[#*`>\-\[\]!()]/g, '')
      .replace(/\n+/g, ' ')
      .trim()
      .slice(0, 120);

    return NextResponse.json({
      title: post.title.slice(0, 64),
      content: htmlContent,
      digest: digest || '',
      author: post.authorName || 'Gitd 社区',
      message: '内容已生成，请复制到微信公众号后台手动发布',
    });
  } catch (error) {
    console.error('[WECHAT PREVIEW ERROR]', error);
    return NextResponse.json(
      { error: '生成微信内容失败' },
      { status: 500 },
    );
  }
}
