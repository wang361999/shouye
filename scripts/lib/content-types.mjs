/**
 * 内容形式扩展库
 * 提供系列文章、新闻速递、速查表、对比评测、案例拆解等多种内容形式
 * 用于 AI 机器人生成多样化的社区内容
 */

// ========== 1. 系列文章定义 ==========
// 每个系列有固定的主题、总篇数、进度追踪
export const CONTENT_SERIES = [
  {
    id: 'agent-dev-series',
    name: 'AI Agent 开发实战',
    description: '从 0 到 1 手把手带你开发一个完整的 AI Agent',
    totalParts: 6,
    category: 'ai-agents',
    tags: ['AI Agent', '开发实战', '系列教程'],
    parts: [
      { title: 'AI Agent 开发实战（一）：什么是 Agent，核心架构拆解', keywords: ['Agent 架构', '核心组件', 'ReAct', '规划执行'] },
      { title: 'AI Agent 开发实战（二）：工具调用（Function Calling）原理与实现', keywords: ['Function Calling', '工具调用', 'OpenAI', '函数调用'] },
      { title: 'AI Agent 开发实战（三）：记忆系统设计——短期记忆与长期记忆', keywords: ['记忆系统', '向量数据库', 'RAG', '上下文管理'] },
      { title: 'AI Agent 开发实战（四）：多 Agent 协作模式与实践', keywords: ['多Agent', '协作模式', '任务分解', '角色分工'] },
      { title: 'AI Agent 开发实战（五）：评估与优化——怎么判断 Agent 做得好不好', keywords: ['Agent评估', '效果优化', '评测指标', '调试技巧'] },
      { title: 'AI Agent 开发实战（六）：生产部署与成本控制', keywords: ['生产部署', '成本优化', '监控告警', '稳定性'] },
    ],
  },
  {
    id: 'prompt-engineering-series',
    name: 'Prompt 工程师养成指南',
    description: '系统学习 Prompt 工程，从入门到精通',
    totalParts: 5,
    category: 'ai-prompts',
    tags: ['Prompt工程', '系统教程', '系列'],
    parts: [
      { title: 'Prompt 工程师养成（一）：基础原则与常见误区', keywords: ['Prompt基础', '设计原则', '常见误区'] },
      { title: 'Prompt 工程师养成（二）：结构化提示词——让输出更稳定', keywords: ['结构化Prompt', '角色设定', '输出格式', 'Few-shot'] },
      { title: 'Prompt 工程师养成（三）：思维链（CoT）与推理增强技巧', keywords: ['思维链', 'CoT', '推理能力', '分步思考'] },
      { title: 'Prompt 工程师养成（四）：提示词调试与优化方法论', keywords: ['Prompt调试', '优化技巧', '迭代方法', '效果评估'] },
      { title: 'Prompt 工程师养成（五）：实战案例——5个高频场景提示词模板', keywords: ['实战案例', '模板分享', '代码生成', '文案写作'] },
    ],
  },
  {
    id: 'ai-tool-weekly',
    name: '每周 AI 工具精选',
    description: '每周精选 5 个实用 AI 工具，附使用评测',
    totalParts: 0, // 0 表示持续更新的连载系列
    category: 'ai-tools',
    tags: ['AI工具', '每周精选', '工具评测'],
    isWeekly: true,
  },
];

// ========== 2. AI 新闻速递模板 ==========
export const NEWS_DIGEST_TEMPLATE = {
  structure: `## 头条
（1-2 条最重要的 AI 新闻，每条 100-200 字）

## 模型与技术
（3-4 条模型发布、技术突破相关，配简要解读）

## 开源与工具
（3-4 条新开源项目、新工具发布）

## 产业动态
（2-3 条融资、公司动态、政策相关）

## 一句话速览
（5-8 条一句话新闻，快速了解行业动态）`,
  lengthRange: [1500, 2500],
};

// ========== 3. 速查表 / Cheat Sheet 模板 ==========
export const CHEATSHEET_TEMPLATE = {
  structure: `## 速查表说明
（简要说明这个速查表的用途、适用场景）

## 基础语法
（最常用的基础语法/命令，表格形式）

## 进阶用法
（进阶技巧和常用模式）

## 常见问题
（FAQ 形式，常见问题及答案）

## 实用工具/资源
（相关工具、扩展、学习资源推荐）`,
  lengthRange: [800, 1500],
};

// ========== 4. 对比评测表模板 ==========
export const COMPARISON_TEMPLATE = {
  structure: `## 对比背景
（为什么要做这次对比，适合谁看）

## 对比维度说明
（说明从哪些维度对比，评分标准是什么）

## 详细对比
### 维度一：____
### 维度二：____
### 维度三：____
（每个维度下对比各方案的表现）

## 横向对比表
（一张 Markdown 表格汇总所有维度对比结果）

## 选型建议
（不同场景下分别推荐哪个方案）

## 总结`,
  lengthRange: [1500, 2500],
};

// ========== 5. 案例拆解模板 ==========
export const CASE_STUDY_TEMPLATE = {
  structure: `## 项目背景
（这个项目/案例是什么，解决了什么问题）

## 技术架构
（整体架构图描述、核心技术栈）

## 关键实现
### 模块一：____
### 模块二：____
（2-3 个核心模块的实现细节，带代码）

## 踩过的坑
（3-5 个实际遇到的问题和解决方案）

## 效果与反思
（最终效果、数据、经验教训）

## 完整代码
（核心代码或 GitHub 链接）`,
  lengthRange: [1800, 3000],
};

// ========== 6. 话题挑战模板（UGC 引导） ==========
export const CHALLENGE_TEMPLATE = {
  structure: `## 本期挑战
（一句话说明挑战主题，简洁有吸引力）

## 挑战规则
1. 规则一
2. 规则二
3. 参与方式

## 示例参考
（给一个简单的示例，降低参与门槛）

## 奖励/亮点
（参与有什么好处，或者优秀作品会被推荐等）

## 怎么参与
（具体步骤：发帖、加标签、@ 某人等）`,
  lengthRange: [500, 1000],
};

// ========== 7. 话题挑战列表 ==========
export const CHALLENGE_IDEAS = [
  {
    title: '【挑战】用 3 行 Prompt 让 AI 写出最离谱的代码',
    tags: ['挑战', 'Prompt', '趣味'],
    category: 'ai-prompts',
    description: '谁能用最少的 Prompt 让 AI 生成最离谱/最好玩的代码',
  },
  {
    title: '【征集】你遇到过最奇葩的 AI 幻觉是什么？',
    tags: ['征集', 'AI幻觉', '吐槽'],
    category: 'ai-tools',
    description: '分享你遇到的 AI 胡说八道、一本正经瞎编的经历',
  },
  {
    title: '【投票】你最常用的 AI 编程助手是哪个？',
    tags: ['投票', 'AI工具', '编程助手'],
    category: 'ai-tools',
    description: '来投个票，看看大家都在用什么 AI 编程工具',
  },
  {
    title: '【挑战】用 AI 一天能做多少事？来晒你的效率清单',
    tags: ['挑战', '效率', 'AI生产力'],
    category: 'ai-tools',
    description: '分享你一天中用 AI 完成了哪些事，效率提升了多少',
  },
  {
    title: '【征集】你的第一个 AI Agent 做了什么？',
    tags: ['征集', 'Agent', '处女作'],
    category: 'ai-agents',
    description: '分享你开发的第一个 AI Agent，不管多简单都可以',
  },
  {
    title: '【投票】AI 会取代初级程序员吗？',
    tags: ['投票', '职业发展', '讨论'],
    category: 'ai-tools',
    description: '你怎么看 AI 对程序员职业的影响？来投票聊聊',
  },
];

// ========== 工具函数 ==========

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 获取随机系列文章主题
export function getRandomSeriesTopic(recentTopics = []) {
  // 优先选有固定篇数的系列
  const seriesWithParts = CONTENT_SERIES.filter(s => s.totalParts > 0 && s.parts.length > 0);
  if (seriesWithParts.length === 0) return null;

  const series = pickRandom(seriesWithParts);
  // 从该系列中选一篇还没写过的
  const availableParts = series.parts.filter(
    p => !recentTopics.some(rt => rt.includes(p.title) || p.title.includes(rt))
  );
  if (availableParts.length === 0) {
    // 都写过了就随机选一篇重写（换角度）
    const part = pickRandom(series.parts);
    return {
      series,
      part,
      partIndex: series.parts.indexOf(part),
      isRepeat: true,
    };
  }
  const part = pickRandom(availableParts);
  return {
    series,
    part,
    partIndex: series.parts.indexOf(part),
    isRepeat: false,
  };
}

// 获取随机话题挑战
export function getRandomChallenge(recentTopics = []) {
  const available = CHALLENGE_IDEAS.filter(
    c => !recentTopics.some(rt => rt.includes(c.title) || c.title.includes(rt))
  );
  if (available.length === 0) return pickRandom(CHALLENGE_IDEAS);
  return pickRandom(available);
}

// 生成系列文章前缀（用于标题和内容开头）
export function buildSeriesPrefix(seriesInfo) {
  const { series, part, partIndex } = seriesInfo;
  const progress = series.totalParts > 0
    ? `（${partIndex + 1}/${series.totalParts}）`
    : '';

  return {
    titlePrefix: `${series.name}${progress}：`,
    intro: `> 本文是「${series.name}」系列的第 ${partIndex + 1} 篇${series.totalParts > 0 ? `，共 ${series.totalParts} 篇` : '（连载中）'}。\n>\n> ${series.description}\n`,
    tags: series.tags,
    category: series.category,
  };
}

// 随机选择内容类型
export function pickRandomContentType(options = {}) {
  const types = [
    { id: 'normal', weight: 40 },        // 普通文章（现有）
    { id: 'series', weight: 25 },        // 系列文章
    { id: 'news-digest', weight: 15 },   // 新闻速递
    { id: 'cheatsheet', weight: 10 },    // 速查表
    { id: 'comparison', weight: 7 },     // 对比评测
    { id: 'case-study', weight: 3 },     // 案例拆解
  ];

  // 过滤掉被排除的类型
  const filtered = options.exclude
    ? types.filter(t => !options.exclude.includes(t.id))
    : types;

  const totalWeight = filtered.reduce((sum, t) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;

  for (const type of filtered) {
    random -= type.weight;
    if (random <= 0) return type.id;
  }
  return filtered[0].id;
}

// 获取对应内容类型的结构模板
export function getContentTypeTemplate(type) {
  switch (type) {
    case 'news-digest':
      return {
        structure: NEWS_DIGEST_TEMPLATE.structure,
        lengthRange: NEWS_DIGEST_TEMPLATE.lengthRange,
        typeName: '新闻速递',
      };
    case 'cheatsheet':
      return {
        structure: CHEATSHEET_TEMPLATE.structure,
        lengthRange: CHEATSHEET_TEMPLATE.lengthRange,
        typeName: '速查表',
      };
    case 'comparison':
      return {
        structure: COMPARISON_TEMPLATE.structure,
        lengthRange: COMPARISON_TEMPLATE.lengthRange,
        typeName: '对比评测',
      };
    case 'case-study':
      return {
        structure: CASE_STUDY_TEMPLATE.structure,
        lengthRange: CASE_STUDY_TEMPLATE.lengthRange,
        typeName: '案例拆解',
      };
    default:
      return null; // 使用原有的随机结构
  }
}
