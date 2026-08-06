/**
 * AI 发帖内容模板工具
 * 用于统一自动发帖的专业结构、互动引导和 AI 辅助说明。
 *
 * 优化点：
 * - 多种文章结构模板，避免机械化重复
 * - 多样化写作风格
 * - 多样化开头/结尾方式
 * - 内容去重与差异化机制
 */

export function normalizeTags(tags, fallback = []) {
  const source = Array.isArray(tags) ? tags : fallback;
  return [...new Set(
    source
      .map((tag) => String(tag || '').trim())
      .filter((tag) => tag.length > 0 && tag.length <= 20),
  )].slice(0, 5);
}

export function normalizeTitle(title, fallbackTitle) {
  const cleanTitle = String(title || fallbackTitle || '技术分享')
    .replace(/^#+\s*/, '')
    .replace(/[《》]/g, '')
    .trim();

  if (cleanTitle.length <= 80) return cleanTitle;
  return `${cleanTitle.slice(0, 77)}...`;
}

const HIGH_QUALITY_ACCURACY_RULES = `
## 准确性与反编造要求（必须遵守）

1. 不得编造不存在的 API、命令、配置项、版本特性、发布日期、性能数字、Star 数、公司案例或项目数据。
2. 不确定的信息必须明确写"以官方文档/官方仓库为准"，不要把推测写成事实。
3. 不能虚构链接。只有在你确定链接真实且稳定时才写 URL；否则不要写链接。
4. 不要使用"最新数据显示""官方表示""业内统计"等无法核验的表述，除非上下文提供了明确来源。
5. 代码示例必须使用稳定、常见、可解释的写法；不要编造库名、方法名或参数。
6. 如果主题依赖特定版本，必须写清楚"请以当前版本文档为准"，不要强行给出未经确认的版本号。
7. 宁可少写，也不要为了显得丰富而补虚假细节。
8. 输出前自检：是否有无法确认的事实、是否有占位符、是否有未解释的命令、是否有夸大结论。`;

export function validateGeneratedPostQuality({ title, content, tags = [], mode = 'forum' } = {}) {
  const issues = [];
  const cleanTitle = String(title || '').trim();
  const cleanContent = String(content || '').trim();

  if (cleanTitle.length < 8) issues.push('标题过短，信息量不足');
  if (cleanTitle.length > 90) issues.push('标题过长，影响阅读和 SEO');
  if (cleanContent.length < 500) issues.push('正文过短，达不到高质量自动发帖要求');

  const forbiddenPatterns = [
    { re: /作为\s*(一个)?\s*AI|我是\s*(一个)?\s*AI|身为\s*(一个)?\s*AI/i, msg: '出现 AI 自称' },
    { re: /TODO|TBD|待补充|占位|示例链接|your[-_ ]?(api|token|key)|example\.com/i, msg: '出现占位符或示例占位内容' },
    { re: /随便|大概就行|水文|凑字数|编一个/i, msg: '出现低质量或编造倾向表达' },
    { re: /最新数据显示|权威数据显示|官方数据显示|业内统计显示|据统计[,，]?目前/g, msg: '出现无法核验的数据来源表述' },
    { re: /神器|完美解决|颠覆性|必用|秒杀|吊打/g, msg: '出现夸张营销表达' },
    { re: /https?:\/\/(localhost|127\.0\.0\.1|example\.com|your-domain|todo)/i, msg: '出现无效或占位链接' },
  ];

  for (const { re, msg } of forbiddenPatterns) {
    if (re.test(cleanTitle) || re.test(cleanContent)) issues.push(msg);
  }

  const codeFenceCount = (cleanContent.match(/```/g) || []).length;
  if (codeFenceCount % 2 !== 0) issues.push('Markdown 代码块未闭合');

  const headings = cleanContent.match(/^##\s+/gm) || [];
  if (mode !== 'short' && headings.length < 3) {
    issues.push('正文结构不足，至少需要 3 个二级标题');
  }

  if (Array.isArray(tags) && tags.some((tag) => String(tag).trim().length > 20)) {
    issues.push('标签过长');
  }

  return { ok: issues.length === 0, issues };
}

export function assertGeneratedPostQuality(post, options = {}) {
  const result = validateGeneratedPostQuality({
    title: post?.title,
    content: post?.content,
    tags: post?.tags,
    mode: options.mode || 'forum',
  });
  if (!result.ok) {
    throw new Error(`AI 生成内容质量校验失败：${result.issues.join('；')}`);
  }
  return post;
}

// ===== 多样化讨论问题 =====
const DISCUSSION_QUESTIONS = [
  '你在实际项目中遇到过类似问题吗？欢迎补充你的经验和方案。',
  '大家对这个话题有什么不同的看法？欢迎在评论区聊聊。',
  '你平时是怎么处理这类问题的？有没有更好的实践？',
  '这篇文章里哪个点最让你有共鸣？或者你有不同意见？',
  '有没有人用过类似的方案吗？来分享一下踩坑经验。',
  '你觉得这个方向未来会怎么发展？欢迎大胆预测一下。',
  '如果是你，你会怎么设计/选型？为什么？',
  '有没有补充的工具或资源？欢迎在评论区安利一下。',
  '看完这篇你最大的收获是什么？还有什么想了解的？',
  '你们团队在这方面有什么实践？来交流一下。',
];

// ===== 多样化结尾引导语 =====
const CLOSING_LINES = [
  '以上就是我对这个话题的一些思考，抛砖引玉。',
  '先分享到这里，希望对你有帮助的话点个赞支持一下。',
  '个人经验难免有局限，欢迎大家补充指正。',
  '实践出真知，建议动手试试才知道适不适合自己。',
  '技术在变，思路是相通的。',
  '写得比较长，能看到这里的都是真爱。',
  '一点浅见，欢迎讨论。',
  '持续学习，持续进步。',
];

// ===== 多样化开头方式 =====
const OPENING_STYLES = [
  {
    name: '问题引入',
    template: '最近在做项目的时候遇到一个问题：______。折腾了一番，总结一下经验。'
  },
  {
    name: '场景描述',
    template: '这段时间一直在研究______，踩了不少坑，今天来聊聊我的理解。'
  },
  {
    name: '对比引入',
    template: '之前一直用______，最近试了试______，差别还挺大的。'
  },
  {
    name: '经验总结',
    template: '做了快一年多的______，有些心得想记录下来。'
  },
  {
    name: '趋势观察',
    template: '最近______越来越火了，来聊聊它到底解决了什么问题。'
  },
  {
    name: '踩坑复盘',
    template: '昨天线上出了个问题，排查下来是______导致的，复盘一下。'
  },
  {
    name: '工具推荐',
    template: '发现了一个宝藏工具______，用了之后效率提升不少。'
  },
  {
    name: '观点抛出',
    template: '我一直觉得______这件事，很多人都理解错了。'
  },
];

// ===== 文章结构模板 =====
const POST_STRUCTURE_TEMPLATES = [
  {
    id: 'tutorial',
    name: '入门教程型',
    structure: `## 为什么需要它
## 核心概念
## 快速上手
## 进阶用法
## 注意事项`,
    lengthRange: [1000, 1800],
  },
  {
    id: 'comparison',
    name: '对比评测型',
    structure: `## 背景
## 对比维度
## 各方案详解
## 选型建议
## 总结`,
    lengthRange: [1200, 2000],
  },
  {
    id: 'pitfall',
    name: '踩坑经验型',
    structure: `## 问题现象
## 排查过程
## 根本原因
## 解决方案
## 预防措施`,
    lengthRange: [800, 1500],
  },
  {
    id: 'deepdive',
    name: '深度解析型',
    structure: `## 现象
## 原理
## 实现
## 优化
## 展望`,
    lengthRange: [1500, 2500],
  },
  {
    id: 'roundup',
    name: '盘点汇总型',
    structure: `## 写在前面
## 方案一：____
## 方案二：____
## 方案三：____
## 怎么选`,
    lengthRange: [1200, 2000],
  },
  {
    id: 'practice',
    name: '实战案例型',
    structure: `## 需求背景
## 技术选型
## 实现过程
## 效果评估
## 经验总结`,
    lengthRange: [1000, 1800],
  },
  {
    id: 'opinion',
    name: '观点评论型',
    structure: `## 我的看法
## 为什么这么说
## 反方观点
## 折中方案
## 结语`,
    lengthRange: [800, 1400],
  },
  {
    id: 'tool',
    name: '工具推荐型',
    structure: `## 这是什么
## 能做什么
## 怎么用
## 同类对比
## 适用场景`,
    lengthRange: [900, 1600],
  },
];

// ===== 写作风格 =====
const WRITING_STYLES = [
  {
    id: 'professional',
    name: '专业严谨',
    prompt: '用词专业、逻辑清晰、结构严谨，像资深工程师写的技术博客。',
  },
  {
    id: 'casual',
    name: '轻松分享',
    prompt: '语气轻松、像和朋友聊天一样分享经验，可以用一些口语化表达，但不要太随意。',
  },
  {
    id: 'practical',
    name: '干货实战',
    prompt: '注重实操导向、少说理论、多给具体做法和代码示例。',
  },
  {
    id: 'story',
    name: '故事叙述',
    prompt: '用讲故事的方式，从问题出发，一步步展开，有过程有细节。',
  },
];

// ===== 随机选择工具 =====
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickNRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ===== 生成多样化 prompt 规则 =====
export function buildDiversePromptRules({ mode = 'forum', botPersona = '', topic = '' } = {}) {
  const structure = pickRandom(POST_STRUCTURE_TEMPLATES);
  const style = pickRandom(WRITING_STYLES);
  const opening = pickRandom(OPENING_STYLES);
  const discussion = pickRandom(DISCUSSION_QUESTIONS);
  const closing = pickRandom(CLOSING_LINES);

  const commonRules = `
## 专业度要求

1. 标题要像技术社区优质帖：明确技术对象、问题或收益，不要标题党。
2. 开头用「${opening.name}」式开头，不要千篇一律地"今天来聊聊"。可以参考这个感觉：${opening.template}
3. 正文结构参考下面的推荐结构，但不要生硬套用，根据内容自然组织。
4. 每个主要观点都要落到具体场景、代码、配置、实践步骤或判断标准。
5. 不要写空泛套话，例如"非常重要""大大提升效率"，必须说明为什么。
6. 结尾用「${closing}」然后引出讨论。
7. 技术内容要谨慎，不能编造不存在的 API、命令、版本特性。
8. 标签要短、准确，优先使用技术名词或场景词。
9. 写作风格：${style.prompt}

## 代码块规范（必须遵守）

涉及代码、命令、配置、JSON 等内容时，**必须使用 Markdown 代码块包裹**，并指定正确的语言类型：

- JavaScript/TypeScript 代码用 \`\`\`javascript 或 \`\`\`typescript
- Python 代码用 \`\`\`python
- Shell 命令用 \`\`\`bash
- JSON/YAML 配置用 \`\`\`json 或 \`\`\`yaml
- HTML/CSS 用 \`\`\`html 或 \`\`\`css
- SQL 用 \`\`\`sql

代码块使用规范：
1. 代码要完整可运行，不要只写片段让读者猜
2. 关键代码要加注释说明用途和注意事项
3. 命令行示例要说明执行效果或预期输出
4. 配置文件要说明放在哪个位置、如何使用
5. 技术类文章至少包含 1-2 个有价值的代码示例
6. 不要把代码写在普通段落里，必须用代码块包裹

${HIGH_QUALITY_ACCURACY_RULES}
`;

  if (mode === 'deep') {
    return {
      rules: `${commonRules}
## 推荐文章结构（参考即可，不要生硬套用）

${structure.structure}

## 讨论问题（放在最后引导评论）

${discussion}`,
      meta: { structure, style, opening, discussion, closing },
    };
  }

  return {
    rules: `${commonRules}
## 推荐帖子结构（参考即可，根据内容灵活调整）

${structure.structure}

## 讨论引导

${discussion}`,
    meta: { structure, style, opening, discussion, closing },
  };
}

export function appendProfessionalFooter(content, options = {}) {
  const {
    discussionQuestion = null,
    includeAiNote = true,
    style = 'default',
  } = options;

  let result = String(content || '').trim();

  // 如果没有讨论区，加一个
  if (!/##\s*(讨论|延伸讨论|欢迎讨论|互动|大家觉得呢|写在最后)/.test(result)) {
    const question = discussionQuestion || pickRandom(DISCUSSION_QUESTIONS);
    result += `\n\n## 讨论\n\n${question}`;
  }

  if (includeAiNote && !/AI\s*辅助|AI 辅助|人工校对|Gitd 社区 AI/.test(result)) {
    // 多样化的 AI 声明
    const aiNotes = [
      '> 本文由 Gitd 社区 AI 辅助整理，内容已按技术社区阅读场景优化。若有错误或更好的实践，欢迎评论区指出。',
      '> 内容由 AI 辅助生成，仅供参考。实践中请以官方文档为准，欢迎补充指正。',
      '> Gitd 社区 AI 整理，技术细节如有疏漏，欢迎在评论区补充。',
    ];
    result += `\n\n---\n\n${pickRandom(aiNotes)}`;
  }

  return result;
}

export function buildProfessionalPromptRules({ mode = 'forum' } = {}) {
  // 为了向后兼容，内部调用多样化版本
  const { rules } = buildDiversePromptRules({ mode });
  return rules;
}

/**
 * 微信公众号「开源风」发帖规则
 * 适用于 Gitd 社区 AI 机器人：用 Markdown 写作，但结构、节奏和信息密度贴近微信公众号开源模板。
 */
export function buildWechatOpenSourcePromptRules({ topicKind = 'general' } = {}) {
  const isOpenSource = topicKind === 'open-source';
  const discussion = pickRandom(DISCUSSION_QUESTIONS);

  return `
## 微信公众号开源风模板要求

整体风格参考微信公众号「开源风格」：清爽、克制、有社区感，像一篇可以直接同步到公众号的开源/技术精选文章。

${HIGH_QUALITY_ACCURACY_RULES}

### 版式结构

必须严格使用下面的 Markdown 结构，不要随意换标题：

> 开源共创：用 1-2 句话说明本文最值得读的点，语气克制，不要夸张营销。

## 速览

用 3-5 条短 bullet 总结核心信息。每条控制在一行左右。

## 为什么值得关注

说明背景、痛点或趋势，短段落，不要长篇铺垫。

## 核心亮点

列出 3-5 个亮点。每个亮点要说明「解决什么问题」和「适合什么场景」。

## 适用场景

写清楚适合谁、不适合谁。避免只写优点。

## 快速上手

给出最小可用步骤。可以包含命令或代码块，但代码块只放必要内容，不要堆太长。

## 选型与避坑

给出实际选型建议、常见误区、版本/依赖/协议/性能/维护风险。

## 总结

用 2-4 句话收束，强调可执行判断。

## 讨论

${discussion}

### 内容规则

1. 每个二级标题下优先使用短段落和短列表，避免大段文字。
2. 不使用夸张宣传词，例如"神器""颠覆""必用""完美解决"。
3. 如果涉及开源项目，必须写清楚：项目定位、原作者/维护方、原仓库链接、开源协议；如果无法确定，明确写"以官方仓库信息为准"，不要编造。
4. 如果涉及技术教程，必须写清楚前提条件、适用版本、最小示例和风险点。
5. 代码块语言必须标注清楚，例如 \`\`\`bash、\`\`\`ts、\`\`\`sql、\`\`\`python、\`\`\`javascript。
6. 涉及代码、命令、配置的内容必须用代码块包裹，不能直接写在普通段落里。
7. 代码要完整可运行，关键部分加注释说明。
8. 正文长度控制在 1200-2200 字，移动端阅读优先。
9. 标签要短且准确，优先使用 3-5 个。
${isOpenSource ? '10. 本文必须更偏"开源项目精选/开源治理/协议合规"视角。' : '10. 本文虽然不是开源项目推荐，也要保持"开源社区文章"的清爽结构和实践导向。'}
`;
}

export function appendWechatOpenSourceFooter(content, options = {}) {
  const {
    discussionQuestion = null,
    includeAiNote = true,
  } = options;

  let result = String(content || '').trim();

  if (!/##\s*讨论/.test(result)) {
    const question = discussionQuestion || pickRandom(DISCUSSION_QUESTIONS);
    result += `\n\n## 讨论\n\n${question}`;
  }

  if (includeAiNote && !/Gitd 社区 AI|AI 辅助|人工校对/.test(result)) {
    result += '\n\n---\n\n> Gitd 社区 AI 辅助整理，采用开源风阅读结构。项目、协议、版本等关键信息请以官方资料为准，欢迎在评论区补充校对。';
  }

  return result;
}

// ===== 评论回复多样化 =====
const REPLY_STYLES = [
  { id: 'agree', name: '赞同补充', prompt: '先表示赞同，然后补充自己的经验或延伸话题。' },
  { id: 'question', name: '提问探讨', prompt: '提出一个相关的问题，引导进一步讨论。' },
  { id: 'experience', name: '经验分享', prompt: '分享自己类似的经历或做法。' },
  { id: 'alternative', name: '不同角度', prompt: '从另一个角度看问题，给出不同的思路。' },
  { id: 'thanks', name: '感谢提问', prompt: '感谢对方的提问/分享，然后给出详细解答。' },
];

export function getRandomReplyStyle() {
  return pickRandom(REPLY_STYLES);
}

// ===== 动态主题生成提示 =====
export function buildTopicGenerationPrompt({ bot, recentTopics = [] }) {
  const recentList = recentTopics.length > 0
    ? recentTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : '（无';

  return `请为「${bot.authorName}」生成 5 个新的文章主题。

## 人设
${bot.tagline}

## 最近已经写过的主题（不要再重复）
${recentList}

## 要求
1. 主题要具体、有切入点，不要太宽泛
2. 可以从不同角度切入：工具评测、教程、踩坑、对比、实战、趋势分析等
3. 标题要吸引人，但不要标题党
4. 优先选技术社区用户会感兴趣的话题
5. 每个主题用一句话描述

## 输出格式
只输出 JSON 数组，不要其他文字：
[
  "主题1",
  "主题2",
  "主题3",
  "主题4",
  "主题5"
]`;
}

// ===== 内容角度随机种子（用于增加同主题不同角度 =====
const CONTENT_ANGLES = [
  '从初学者视角',
  '从进阶用户视角',
  '从团队协作角度',
  '从性能优化角度',
  '从工程实践角度',
  '从成本控制角度',
  '从安全角度',
  '从可维护性角度',
  '从产品设计角度',
  '从开发者体验角度',
];

export function getRandomContentAngle() {
  return pickRandom(CONTENT_ANGLES);
}

// ===== 检测内容重复度简单检测 =====
export function estimateSimilarity(title1, title2) {
  // 简单的基于关键词的相似度估计
  const words1 = new Set(title1.toLowerCase().split(/[\s，。、：；,.:;?!？！]/).filter(w => w.length > 1));
  const words2 = new Set(title2.toLowerCase().split(/[\s，。、：；,.:;?!？！]/).filter(w => w.length > 1));
  if (words1.size === 0 || words2.size === 0) return 0;
  let common = 0;
  for (const w of words1) {
    if (words2.has(w)) common++;
  }
  return common / Math.min(words1.size, words2.size);
}

export function pickDiverseTopic(candidates, recentTopics = [], threshold = 0.5) {
  // 从候选中选一个和最近主题相似度低于阈值的
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  for (const topic of shuffled) {
    const maxSim = Math.max(...recentTopics.map(rt => estimateSimilarity(topic, rt)), 0);
    if (maxSim < threshold) return topic;
  }
  // 如果都比较相似，返回最不相似的那个
  let bestTopic = shuffled[0];
  let bestSim = 1;
  for (const topic of shuffled) {
    const maxSim = Math.max(...recentTopics.map(rt => estimateSimilarity(topic, rt)), 0);
    if (maxSim < bestSim) {
      bestSim = maxSim;
      bestTopic = topic;
    }
  }
  return bestTopic;
}

export { pickRandom, pickNRandom, POST_STRUCTURE_TEMPLATES, WRITING_STYLES, DISCUSSION_QUESTIONS, OPENING_STYLES, CONTENT_ANGLES };
