import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ============ 公众号文章适配 API ============
// 根据文章 ID 生成公众号版本：3个标题候选 + 公众号版正文 + 封面图提示词 + 摘要
// POST /api/admin/wechat-adapt
// Body: { postId: string }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId } = body;

    if (!postId) {
      return NextResponse.json({ error: '缺少 postId' }, { status: 400 });
    }

    // 1. 获取文章内容
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        content: true,
        category: { select: { name: true, slug: true } },
        tags: { include: { tag: { select: { name: true } } } },
      },
    });

    if (!post) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    }

    // 2. 调用 AI 生成公众号版本
    const aiResult = await generateWechatVersion(post);

    // 3. 生成封面图提示词（不直接生成图片，返回提示词让用户可以用AI绘图工具生成）
    const coverPrompt = generateCoverPrompt(post.title, post.category?.name || '');

    return NextResponse.json({
      success: true,
      postId: post.id,
      originalTitle: post.title,
      wechatVersion: aiResult,
      coverPrompt,
    });
  } catch (error) {
    console.error('[WECHAT ADAPT ERROR]', error);
    return NextResponse.json(
      { error: '生成公众号版本失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// ============ AI 生成公众号版本 ============
async function generateWechatVersion(post: {
  id: string;
  title: string;
  content: string;
  category: { name: string; slug: string } | null;
  tags: { tag: { name: string } }[];
}) {
  const apiKey = process.env.AI_API_KEY;
  const apiBase = process.env.AI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  const model = process.env.AI_MODEL || 'gemini-3.6-flash';

  if (!apiKey) {
    throw new Error('缺少 AI_API_KEY 配置');
  }

  const tagNames = post.tags?.map((t) => t.tag.name).join('、') || '';
  const categoryName = post.category?.name || '技术';

  // 截取文章内容（避免 token 过长）
  const contentPreview = post.content.length > 6000
    ? post.content.slice(0, 6000) + '\n\n...（内容已截断）'
    : post.content;

  const prompt = `你是一个资深公众号编辑，擅长把技术文章改造成适合公众号阅读的爆款文章。
请根据以下技术文章，生成公众号适配版本。

## 原文信息
标题：${post.title}
分类：${categoryName}
标签：${tagNames}

## 原文内容
${contentPreview}

## 改造要求

### 一、标题（3个候选）
1. 要有吸引力，适合公众号信息流，带痛点或利益点
2. 用数字、疑问、对比等手法提升打开率
3. 每个标题 15-25 字
4. 风格：科技感 + 干货感

### 二、公众号版正文
1. **开头加钩子**（100字以内）：用痛点/故事/数据引入，让读者想继续看
2. **口语化调整**：技术内容保持准确，但语气更像跟朋友聊天，不要太生硬
3. **分段优化**：每段不要太长，2-3行一段，适合手机阅读
4. **重点加粗**：关键结论、核心概念用加粗标记
5. **加入小标题**：用 emoji + 小标题分割长段落，提升可读性
6. **结尾加互动**：最后加一个引导讨论的问题或"在看点这里"
7. **保留代码块**：代码部分保留原样，用 \`\`\` 包裹
8. 字数：和原文差不多，不要大幅删减

### 三、摘要
1. 一句话总结全文（50字以内）
2. 适合放在公众号封面下面的摘要位置

### 四、封面图文案
1. 主标题（封面大字）：8个字以内
2. 副标题（封面小字）：15个字以内

## 输出格式
只输出 JSON，不要其他文字：
{
  "titleCandidates": ["标题候选1", "标题候选2", "标题候选3"],
  "content": "公众号版正文（Markdown格式）",
  "summary": "一句话摘要",
  "coverMainTitle": "封面主标题",
  "coverSubTitle": "封面副标题",
  "keyPoints": ["核心要点1", "核心要点2", "核心要点3"]
}`;

  const response = await fetch(apiBase, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是资深公众号编辑，擅长技术内容的公众号改造。只输出严格 JSON。' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 12000,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
    // 超时 90 秒
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI API 调用失败：${response.status} ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // 解析 JSON
  let result;
  try {
    result = JSON.parse(content);
  } catch {
    // 尝试从文本中提取 JSON
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      result = JSON.parse(match[0]);
    } else {
      throw new Error('AI 返回内容无法解析为 JSON');
    }
  }

  return {
    titleCandidates: result.titleCandidates || [],
    content: result.content || '',
    summary: result.summary || '',
    coverMainTitle: result.coverMainTitle || '',
    coverSubTitle: result.coverSubTitle || '',
    keyPoints: result.keyPoints || [],
  };
}

// ============ 生成封面图提示词 ============
function generateCoverPrompt(title: string, category: string) {
  const styleKeywords = [
    '极简科技风',
    '渐变色背景',
    '扁平化插画',
    '未来科技感',
    '赛博朋克风',
  ];

  const mainElement = category.includes('AI') || category.includes('大模型')
    ? 'AI 机器人、神经网络、数据可视化'
    : category.includes('前端')
    ? '代码、浏览器、界面设计'
    : category.includes('后端')
    ? '服务器、数据库、API 接口'
    : '代码、技术、开发工具';

  return {
    style: '公众号封面图，2.35:1 比例，900x383',
    subject: `关于「${title.slice(0, 20)}」的技术主题封面`,
    elements: mainElement,
    styles: styleKeywords,
    colorSuggestion: '蓝紫色渐变 + 科技感配色',
    fullPrompt: `公众号封面图，2.35:1横版，${mainElement}，${styleKeywords[0]}，蓝紫色渐变科技背景，扁平化设计，简洁大气，适合技术类公众号`,
  };
}
