import { NextRequest, NextResponse } from 'next/server';
import { rateLimitAsync, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';
import { callAI as callAIService } from '@/lib/ai';

/**
 * POST /api/ai/rewrite
 * AI 润色帖子内容（标题、正文、标签推荐）
 *
 * 支持的润色类型：
 *   - polish: 润色正文（优化表达、修正格式、增强可读性）
 *   - title: 优化标题
 *   - tags: 推荐标签
 *   - all: 一次性润色标题+正文+推荐标签
 *
 * 请求体：
 *   { type: 'polish' | 'title' | 'tags' | 'all', title?: string, content?: string, category?: string }
 *
 * 返回：
 *   { type: string, result: { title?: string, content?: string, tags?: string[] }, remaining: number }
 */

// 每 IP 每小时最多 20 次 AI 润色调用
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

// 单次请求最大内容长度
const MAX_CONTENT_LENGTH = 5000;
const MAX_TITLE_LENGTH = 100;

function buildPrompt(type: string, title: string, content: string, category: string): string {
  const categoryDesc = category || '综合讨论';

  switch (type) {
    case 'polish':
      return `你是一个专业的技术社区编辑，请润色以下帖子正文，使其更清晰、专业、有吸引力。

## 帖子信息
- 标题：${title || '（无）'}
- 分类：${categoryDesc}

## 原始正文
${content}

## 润色要求
1. 保持原意不变，不添加虚假信息
2. 优化语言表达，让文字更流畅自然
3. 修正 Markdown 格式问题（标题层级、列表、代码块等）
4. 适当分段，提升可读性
5. 技术性内容保持准确，不修改代码逻辑
6. 保持中文
7. 直接输出润色后的正文，不要解释你做了什么，不要加"润色后"之类的前缀`;

    case 'title':
      return `你是一个资深技术编辑，请为以下帖子优化或生成一个更好的标题。

## 帖子信息
- 分类：${categoryDesc}
- 当前标题：${title || '（无）'}

## 正文内容
${content.slice(0, 2000)}

## 标题要求
1. 长度 10-50 字，简洁有力
2. 包含核心关键词，利于 SEO
3. 吸引开发者点击，但不做标题党
4. 技术类帖子要体现技术栈或问题点
5. 直接输出 3 个候选标题，每行一个，不要编号，不要加其他文字`;

    case 'tags':
      return `请为以下技术帖子推荐 3-5 个合适的标签。

## 帖子信息
- 标题：${title || '（无）'}
- 分类：${categoryDesc}

## 正文内容
${content.slice(0, 2000)}

## 标签要求
1. 3-5 个标签，用逗号分隔
2. 标签要精准，覆盖技术栈和主题
3. 优先用常用标签，不要太冷门
4. 标签名简洁，一般 2-8 个字
5. 直接输出标签，用英文逗号分隔，不要加其他文字`;

    case 'all':
      return `你是一个专业的技术社区编辑，请对以下帖子进行全面优化：优化标题、润色正文、推荐标签。

## 帖子信息
- 分类：${categoryDesc}
- 当前标题：${title || '（无）'}

## 原始正文
${content}

## 输出格式
请严格按以下 JSON 格式输出，不要加其他内容：

{
  "title": "优化后的标题",
  "content": "润色后的正文（保持 Markdown 格式）",
  "tags": ["标签1", "标签2", "标签3"]
}

## 优化要求
- 标题：10-50字，包含关键词，吸引点击
- 正文：保持原意，优化表达，修正格式，提升可读性
- 标签：3-5个，精准覆盖技术栈和主题
- 技术内容保持准确，不修改代码逻辑
- 全部中文`;

    default:
      return '';
  }
}

async function callAI(prompt: string): Promise<string> {
  return callAIService(
    prompt,
    '你是一个专业的技术社区编辑助手，擅长优化技术文章。你的输出精准、专业、不废话。',
    3000,
  );
}

function parseTags(text: string): string[] {
  return text
    .split(/[,，、\s]+/)
    .map((t) => t.trim().replace(/^#/, ''))
    .filter((t) => t.length > 0 && t.length <= 20)
    .slice(0, 5);
}

function parseTitles(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim().replace(/^\d+[\.\)、]\s*/, '').replace(/^["'""'']|["'""'']$/g, ''))
    .filter((l) => l.length > 5 && l.length <= 80)
    .slice(0, 3);
}

function parseAllResult(text: string): { title?: string; content?: string; tags?: string[] } {
  // 尝试解析 JSON
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]);
      return {
        title: obj.title,
        content: obj.content,
        tags: Array.isArray(obj.tags) ? obj.tags.slice(0, 5) : undefined,
      };
    }
  } catch {
    // JSON 解析失败，尝试手动提取
  }

  return {};
}

export async function POST(request: NextRequest) {
  // 限流
  const clientIP = getClientIP(request);
  const rlResult = await rateLimitAsync(`ai-rewrite:${clientIP}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rlResult.success) {
    return NextResponse.json(
      { error: '调用过于频繁，请稍后再试', remaining: 0, resetAt: rlResult.resetAt },
      { status: 429, headers: rateLimitHeaders(rlResult) },
    );
  }

  try {
    const body = await request.json();
    const { type = 'polish', title = '', content = '', category = '' } = body;

    // 校验
    if (!['polish', 'title', 'tags', 'all'].includes(type)) {
      return NextResponse.json({ error: '无效的润色类型' }, { status: 400 });
    }

    if (type === 'polish' || type === 'all') {
      if (!content || content.trim().length < 10) {
        return NextResponse.json({ error: '正文内容太短' }, { status: 400 });
      }
      if (content.length > MAX_CONTENT_LENGTH) {
        return NextResponse.json({ error: `正文过长，最多 ${MAX_CONTENT_LENGTH} 字` }, { status: 400 });
      }
    }

    if (type === 'title' && !content && !title) {
      return NextResponse.json({ error: '请提供标题或正文' }, { status: 400 });
    }

    if (type === 'tags' && !title && !content) {
      return NextResponse.json({ error: '请提供帖子内容' }, { status: 400 });
    }

    // 构建 prompt 并调用 AI
    const prompt = buildPrompt(type, title, content, category);
    const aiResult = await callAI(prompt);

    // 解析结果
    let result: { title?: string; content?: string; tags?: string[]; titleOptions?: string[] } = {};

    switch (type) {
      case 'polish':
        result.content = aiResult;
        break;
      case 'title':
        result.titleOptions = parseTitles(aiResult);
        break;
      case 'tags':
        result.tags = parseTags(aiResult);
        break;
      case 'all':
        result = parseAllResult(aiResult);
        break;
    }

    return NextResponse.json(
      {
        type,
        result,
        remaining: rlResult.remaining,
      },
      { headers: rateLimitHeaders(rlResult) },
    );
  } catch (error) {
    console.error('[AI Rewrite Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI 润色失败，请稍后重试' },
      { status: 500 },
    );
  }
}
