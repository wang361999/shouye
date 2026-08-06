import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/auth';
import {
  buildWechatDigest,
  buildWechatArticleHtml,
  markdownToWechatHtml,
  normalizeWechatTemplate,
} from '@/lib/wechat';

// ============ 公众号格式化 API ============
// 接收 AI 生成的 Markdown 内容，套用公众号模板返回 HTML
// POST /api/admin/wechat-format
// Body: { content: string, title?: string, digest?: string, author?: string, template?: 'technical' | 'open-source' }

export async function POST(request: NextRequest) {
  try {
    const authResult = adminAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const body = await request.json();
    const { content, title, digest, author, template } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: '缺少内容（content）' },
        { status: 400 },
      );
    }

    const normalizedTemplate = normalizeWechatTemplate(template);
    const articleTitle = (title || '公众号文章').slice(0, 64);
    const articleDigest = digest || buildWechatDigest(content);
    const articleAuthor = author || 'Gitd 社区';

    // 转换 Markdown 为微信 HTML
    const htmlContent = markdownToWechatHtml(content, normalizedTemplate);
    const fullContent = buildWechatArticleHtml(
      {
        title: articleTitle,
        content: htmlContent,
        digest: articleDigest,
        author: articleAuthor,
      },
      normalizedTemplate,
    );

    return NextResponse.json({
      title: articleTitle,
      content: htmlContent,
      fullContent,
      digest: articleDigest,
      author: articleAuthor,
      template: normalizedTemplate,
    });
  } catch (error) {
    console.error('[WECHAT FORMAT ERROR]', error);
    return NextResponse.json(
      { error: '格式化失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
