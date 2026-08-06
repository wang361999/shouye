import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ============ 多平台内容适配 API ============
// 根据文章 ID 生成不同平台的适配版本
// POST /api/admin/content-adapt
// Body: { postId: string, platform: 'wechat' | 'toutiao' | 'all' }

type Platform = 'wechat' | 'toutiao' | 'zhihu' | 'juejin' | 'seo' | 'all';

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

    if (platform === 'zhihu' || platform === 'all') {
      const zhihuVersion = await generateZhihuVersion(post);
      result.zhihu = {
        ...zhihuVersion,
      };
    }

    if (platform === 'juejin' || platform === 'all') {
      const juejinVersion = await generateJuejinVersion(post);
      result.juejin = {
        ...juejinVersion,
      };
    }

    if (platform === 'seo' || platform === 'all') {
      const seoVersion = await generateSEOVersion(post);
      result.seo = {
        ...seoVersion,
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

// ============ 知乎版本生成 ============
async function generateZhihuVersion(post: {
  id: string;
  title: string;
  content: string;
  category: { name: string; slug: string } | null;
  tags: { tag: { name: string } }[];
}) {
  const tagNames = post.tags?.map((t) => t.tag.name).join('、') || '';
  const categoryName = post.category?.name || '技术';
  const contentPreview = truncateContent(post.content, 5000);

  const prompt = `你是一位知乎高赞答主，擅长写干货满满的知乎回答和文章。
请把以下技术文章改造成适合知乎发布的版本。

## 原文信息
标题：${post.title}
分类：${categoryName}
标签：${tagNames}

## 原文内容
${contentPreview}

## 知乎改造要求

### 一、标题（3个候选，不同角度）
知乎标题要像一个"问题"或"经验分享"，让人有点击欲：
1. **问题式**：以"如何""为什么""是什么"开头
2. **经验式**："我用X做了Y，效果如何"
3. **对比式**："X和Y到底有什么区别"
每个标题 15-30 字，要有信息增量。

### 二、知乎版正文
1. **开头先亮明观点/结论**：知乎用户喜欢先知道你要说什么，别铺垫
2. **分点论述**：用"第一/第二/第三"或"1./2./3."清晰分段
3. **加入个人经验**：多用"我试过""我的经验是""踩过的坑"等第一人称表述
4. **数据/案例支撑**：用具体例子和数据增强说服力
5. **金句加粗**：核心结论和金句加粗，方便快速阅读
6. **代码要规范**：代码块用正确语言标记，加注释
7. **结尾总结 + 互动**：最后总结核心观点，加一个引导讨论的问题
8. **字数**：1500-3000 字，知乎用户喜欢有深度的内容

### 三、知乎话题标签
3-5 个适合的知乎话题（直接写话题名，不带#）

### 四、一句话摘要
适合放在文章开头的摘要（100字以内）

### 五、核心观点
3-5 条核心观点，每条 20 字以内

## 输出格式
只输出 JSON，不要其他文字：
{
  "titleCandidates": ["标题1", "标题2", "标题3"],
  "content": "知乎版正文（Markdown格式）",
  "summary": "一句话摘要",
  "topics": ["话题1", "话题2", "话题3"],
  "keyPoints": ["核心观点1", "核心观点2", "核心观点3"]
}`;

  return callAIAndParse(prompt, 12000);
}

// ============ 掘金版本生成 ============
async function generateJuejinVersion(post: {
  id: string;
  title: string;
  content: string;
  category: { name: string; slug: string } | null;
  tags: { tag: { name: string } }[];
}) {
  const tagNames = post.tags?.map((t) => t.tag.name).join('、') || '';
  const categoryName = post.category?.name || '技术';
  const contentPreview = truncateContent(post.content, 6000);

  const prompt = `你是一位掘金资深博主，擅长写高质量技术博文，熟悉掘金社区的调性和热榜规则。
请把以下技术文章改造成适合掘金发布的版本。

## 原文信息
标题：${post.title}
分类：${categoryName}
标签：${tagNames}

## 原文内容
${contentPreview}

## 掘金改造要求

### 一、标题（3个候选，不同风格）
掘金标题要专业、有干货感、吸引开发者点击：
1. **教程型**："手把手教你XXX"
2. **深度型**："深入理解XXX原理"
3. **实战型**："从0到1实现XXX"
每个标题 15-25 字，要有明确的技术关键词（方便 SEO 和搜索）。

### 二、掘金版正文
1. **开头要有"钩子"**：用痛点、数据、或一个引人思考的问题开头
2. **结构清晰**：用 ## 大标题和 ### 小标题分层，目录感强
3. **代码要完整**：代码示例要完整可运行，关键部分加注释
4. **图文并茂**：在适合的地方标注【示意图：XXX】，说明可以配什么图
5. **有深度有细节**：掘金用户喜欢深挖原理，不要太浅
6. **结尾有总结**：最后用"总结"或"写在最后"收束全文
7. **引导关注**：文末可以加一句"觉得有用点个赞关注一下"
8. **字数**：2000-4000 字，掘金长文更容易上热榜

### 三、掘金分类和标签
- 推荐分类（前端/后端/人工智能/...）
- 3-5 个技术标签（掘金支持的标签名）

### 四、封面图文案
- 主标题：8个字以内
- 副标题：15个字以内

### 五、掘金文章摘要
100字以内，适合显示在列表页的摘要

## 输出格式
只输出 JSON，不要其他文字：
{
  "titleCandidates": ["标题1", "标题2", "标题3"],
  "content": "掘金版正文（Markdown格式）",
  "summary": "文章摘要",
  "category": "推荐分类",
  "tags": ["标签1", "标签2", "标签3"],
  "coverMainTitle": "封面主标题",
  "coverSubTitle": "封面副标题"
}`;

  return callAIAndParse(prompt, 12000);
}

// ============ SEO 优化版本生成 ============
async function generateSEOVersion(post: {
  id: string;
  title: string;
  content: string;
  category: { name: string; slug: string } | null;
  tags: { tag: { name: string } }[];
}) {
  const tagNames = post.tags?.map((t) => t.tag.name).join('、') || '';
  const categoryName = post.category?.name || '技术';
  const contentPreview = truncateContent(post.content, 4000);

  const prompt = `你是一位 SEO 专家，擅长搜索引擎优化和关键词布局。
请根据以下技术文章，生成 SEO 优化版本。

## 原文信息
标题：${post.title}
分类：${categoryName}
标签：${tagNames}

## 原文内容（摘要）
${contentPreview}

## SEO 优化要求

### 一、SEO 标题（5个候选，不同关键词布局）
针对百度、Google 搜索优化，每个标题包含 1-2 个核心关键词：
1. **教程型**："XXX教程/入门/怎么学"
2. **对比型**："XXX和YYY的区别/哪个好"
3. **问题型**："XXX是什么/为什么/怎么办"
4. **清单型**："XXX有哪些/推荐/排行榜"
5. **深度型**："XXX原理/实现/源码解析"
每个标题 15-30 字，关键词前置，自然不堆砌。

### 二、Meta Description（2个候选）
- 150字以内
- 包含核心关键词
- 有吸引力，让人想点击
- 用数字、疑问、利益点吸引点击

### 三、核心关键词
- 主关键词（1个）
- 长尾关键词（5-8个）
- 相关关键词（5-8个）

### 四、文章内关键词布局建议
- 关键词出现位置（标题、首段、小标题、结尾）
- 建议的 H2/H3 小标题优化
- 内链建议（可以链接到哪些相关内容）

### 五、结构化数据建议
- 适合用什么类型的 Schema 标记
- 重点标记哪些内容

## 输出格式
只输出 JSON，不要其他文字：
{
  "seoTitles": ["SEO标题1", "SEO标题2", "SEO标题3", "SEO标题4", "SEO标题5"],
  "metaDescriptions": ["描述1", "描述2"],
  "mainKeyword": "主关键词",
  "longTailKeywords": ["长尾词1", "长尾词2", "长尾词3"],
  "relatedKeywords": ["相关词1", "相关词2", "相关词3"],
  "keywordLayout": {
    "positions": ["位置1", "位置2"],
    "headings": ["H2建议1", "H2建议2"],
    "internalLinks": ["内链建议1", "内链建议2"]
  },
  "schemaSuggestions": ["建议1", "建议2"]
}`;

  return callAIAndParse(prompt, 8000);
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
