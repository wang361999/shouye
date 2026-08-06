import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ============ 多平台内容适配 API ============
// 根据文章 ID 生成不同平台的适配版本
// POST /api/admin/content-adapt
// Body: { postId: string, platform: 'wechat' | 'toutiao' | 'all' }

type Platform = 'wechat' | 'toutiao' | 'all';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, platform = 'wechat' }: { postId: string; platform?: Platform } = body;

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

    const result: Record<string, unknown> = {
      success: true,
      postId: post.id,
      originalTitle: post.title,
    };

    // 2. 根据平台生成对应版本
    if (platform === 'wechat' || platform === 'all') {
      const wechatVersion = await generateWechatVersion(post);
      const wechatCover = generateCoverPrompt(post.title, post.category?.name || '', 'wechat');
      result.wechat = {
        ...wechatVersion,
        coverPrompt: wechatCover,
      };
    }

    if (platform === 'toutiao' || platform === 'all') {
      const toutiaoVersion = await generateToutiaoVersion(post);
      const toutiaoCover = generateCoverPrompt(post.title, post.category?.name || '', 'toutiao');
      result.toutiao = {
        ...toutiaoVersion,
        coverPrompt: toutiaoCover,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[CONTENT ADAPT ERROR]', error);
    return NextResponse.json(
      { error: '生成失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// ============ 公众号版本生成 ============
async function generateWechatVersion(post: {
  id: string;
  title: string;
  content: string;
  category: { name: string; slug: string } | null;
  tags: { tag: { name: string } }[];
}) {
  const tagNames = post.tags?.map((t) => t.tag.name).join('、') || '';
  const categoryName = post.category?.name || '技术';
  const contentPreview = truncateContent(post.content, 6000);

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

### 五、核心要点
3-5 条核心要点，每条 20 字以内

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

  return callAIAndParse(prompt, 12000);
}

// ============ 头条版本生成 ============
async function generateToutiaoVersion(post: {
  id: string;
  title: string;
  content: string;
  category: { name: string; slug: string } | null;
  tags: { tag: { name: string } }[];
}) {
  const tagNames = post.tags?.map((t) => t.tag.name).join('、') || '';
  const categoryName = post.category?.name || '技术';
  const contentPreview = truncateContent(post.content, 5000);

  const prompt = `你是一个资深头条号运营专家，非常懂头条的推荐算法和用户阅读习惯。
请把以下技术文章改造成适合今日头条发布的版本。

## 原文信息
标题：${post.title}
分类：${categoryName}
标签：${tagNames}

## 原文内容
${contentPreview}

## 头条改造要求

### 一、标题（5个候选，不同风格）
头条标题直接决定点击率，要够吸引人但不能标题党。
1. **悬念式**：抛出疑问或反差，让人想点进来
2. **数字式**：用具体数字增强说服力
3. **对比式**：前后对比、对错对比
4. **干货式**：直接说能学到什么
5. **故事式**：用经历/案例引入
每个标题 20-30 字，要有信息增量，不要空洞。

### 二、头条版正文（原创优化版）
1. **开头3秒抓住人**：第一句就要有悬念/冲突/干货结论，别铺垫
2. **段落更碎**：一句话一段也可以，每段不超过3行，适合手机刷读
3. **加入个人化表达**：多用"我觉得""根据我的经验""踩过的坑""亲测"等，增加真实感，提高原创度
4. **配图提示**：每 300 字左右标注一个【配图建议：XXX】，说明这一段配什么图好
5. **加入金句**：提炼 1-2 句容易被引用的金句，用加粗标出来
6. **逻辑清晰**：用"第一/第二/第三"或"首先/其次/最后"串联
7. **结尾全套互动引导**：点赞+收藏+评论+关注，四连引导
8. **字数控制**：800-1500 字，短平快，别太啰嗦
9. **保留代码块**：代码部分保留原样

### 三、话题标签
3-5 个适合头条的话题标签（不带 #，直接写话题名），要选流量大的话题

### 四、封面图文案
1. 主标题：10个字以内
2. 副标题：20个字以内

### 五、核心金句
2-3 条容易传播的金句

## 输出格式
只输出 JSON，不要其他文字：
{
  "titleCandidates": ["标题1", "标题2", "标题3", "标题4", "标题5"],
  "content": "头条版正文（Markdown格式，带配图建议）",
  "summary": "一句话摘要",
  "topics": ["话题1", "话题2", "话题3"],
  "coverMainTitle": "封面主标题",
  "coverSubTitle": "封面副标题",
  "goldenSentences": ["金句1", "金句2"]
}`;

  return callAIAndParse(prompt, 12000);
}

// ============ 通用 AI 调用 ============
async function callAIAndParse(prompt: string, maxTokens: number) {
  const apiKey = process.env.AI_API_KEY;
  const apiBase = process.env.AI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  const model = process.env.AI_MODEL || 'gemini-3.6-flash';

  if (!apiKey) {
    throw new Error('缺少 AI_API_KEY 配置');
  }

  const response = await fetch(apiBase, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是资深内容运营专家，擅长多平台内容适配。只输出严格 JSON。' },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.75,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(120000),
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
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      result = JSON.parse(match[0]);
    } else {
      throw new Error('AI 返回内容无法解析为 JSON');
    }
  }

  return result;
}

// ============ 封面图提示词生成 ============
function generateCoverPrompt(title: string, category: string, platform: 'wechat' | 'toutiao') {
  const ratio = platform === 'wechat' ? '2.35:1（900×383）' : '16:9（1080×608）';
  const mainElement = category.includes('AI') || category.includes('大模型')
    ? 'AI 机器人、神经网络、数据可视化、发光芯片'
    : category.includes('前端')
    ? '代码编辑器、浏览器窗口、界面设计元素'
    : category.includes('后端')
    ? '服务器机架、数据库图标、API 连接、代码流'
    : '代码符号、技术图标、开发工具';

  const styles = [
    '极简科技风，扁平化设计',
    '渐变色背景，未来科技感',
    '3D 渲染，赛博朋克风',
  ];

  const fullPrompt = `${platform === 'wechat' ? '公众号封面图' : '今日头条封面图'}，${ratio}横版比例，${mainElement}，${styles[0]}，蓝紫色科技渐变配色，简洁大气，文字区域留白，适合技术类${platform === 'wechat' ? '公众号' : '头条号'}封面`;

  return {
    style: `${platform === 'wechat' ? '公众号' : '头条'}封面图，${ratio}`,
    subject: `关于「${title.slice(0, 20)}」的技术主题封面`,
    elements: mainElement,
    styles,
    colorSuggestion: '蓝紫色渐变 + 科技感配色',
    fullPrompt,
  };
}

// ============ 工具函数 ============
function truncateContent(content: string, maxLen: number): string {
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen) + '\n\n...（内容已截断，生成时请基于核心观点展开）';
}
