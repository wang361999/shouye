#!/usr/bin/env node

/**
 * AI 分类机器人自动发帖脚本（深度优化版）
 * 管理四个 AI 机器人，每个负责一个 AI 分类（AI 工具 / 大模型 / Agent 开发 / Prompt 工程）。
 *
 * 优化特性：
 * - 8 种文章结构模板随机选择（教程/对比/踩坑/深度/盘点/实战/观点/工具）
 * - 4 种写作风格随机切换（专业严谨/轻松分享/干货实战/故事叙述）
 * - 8 种开头方式随机变化
 * - 动态主题生成（AI 自动生成新主题，避免固定主题池重复）
 * - 内容去重检测（避免近期重复主题）
 * - 10 种不同角度切入（初学者/进阶/团队/性能/工程/成本/安全/可维护性等）
 * - 多样化结尾和讨论引导
 * - 内容长度随结构变化（800-2500 字范围）
 *
 * 用法：
 *   node scripts/auto-ai-bots.mjs            # 正式发帖
 *   node scripts/auto-ai-bots.mjs --dry-run  # 预览生成内容但不发布
 *
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL
 */

import { callAI, siteFetch, robustJSONParse, extractPostFromText } from './lib/ai-client.mjs';
import {
  appendProfessionalFooter,
  assertGeneratedPostQuality,
  buildDiversePromptRules,
  buildTopicGenerationPrompt,
  normalizeTags,
  normalizeTitle,
  pickDiverseTopic,
  getRandomContentAngle,
  pickRandom,
} from './lib/post-template.mjs';
import {
  pickRandomContentType,
  getContentTypeTemplate,
  getRandomSeriesTopic,
  buildSeriesPrefix,
  getRandomChallenge,
  CONTENT_SERIES,
} from './lib/content-types.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
} = process.env;

const TAG = '[auto-ai-bots]';
const DRY_RUN = process.argv.includes('--dry-run');
const AI_GENERATE_RETRIES = 2;

// ===== 内容策略配置 =====
const POSTS_PER_RUN = parseInt(process.env.POSTS_PER_RUN || '2', 10);

// 时间段策略
function getTimeBasedSelection() {
  const hour = new Date().getUTCHours() + 8;
  if (hour >= 8 && hour < 11) return ['ai-tools', 'prompt'];
  if (hour >= 14 && hour < 17) return ['llm', 'ai-agent'];
  return null;
}

function selectBotsForRun(bots) {
  const timeBased = getTimeBasedSelection();
  let selected;

  if (timeBased) {
    selected = bots.filter(b => timeBased.includes(b.key));
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const hour = new Date().getUTCHours() + 8;
    const period = Math.floor(hour / 6);
    const seed = today + '-' + period;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const startIdx = Math.abs(hash) % bots.length;
    selected = [];
    for (let i = 0; i < Math.min(POSTS_PER_RUN, bots.length); i++) {
      selected.push(bots[(startIdx + i) % bots.length]);
    }
  }

  return selected.slice(0, POSTS_PER_RUN);
}

function log(message) { console.log(`${TAG} ${message}`); }
function warn(message) { console.warn(`${TAG} ${message}`); }
function fail(message) { console.error(`::error::${TAG} ${message}`); process.exit(1); }

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (!DRY_RUN) {
  if (!SITE_URL) fail('缺少 SITE_URL');
  if (!ADMIN_PASSWORD) warn('未配置 ADMIN_PASSWORD，将仅依赖 AI Agent 注册');
}

// ===== 四个 AI 分类机器人配置 =====
const BOTS = [
  {
    key: 'ai-tools',
    authorName: 'AI工具探索者',
    categorySlug: 'ai-tools',
    tagline: 'AI 工具推荐、评测与使用技巧',
    promptHint: 'AI 工具实战：推荐一款实用的 AI 工具，或分享 AI 工具的使用技巧、效率提升方法，包含工具介绍、核心功能、使用场景、使用教程和选型建议',
    discussionQuestion: '你用过哪些好用的 AI 工具？欢迎在评论区分享你的使用体验和效率提升技巧。',
    defaultTags: ['AI工具', '效率工具'],
    persona: { name: 'AIToolsExplorer', owner: 'Gitd Community', desc: 'AI 工具爱好者，探索和评测各种 AI 生产力工具' },
    topics: [
      '2026 年值得收藏的 10 个 AI 编程助手对比',
      'Cursor vs Windsurf：AI IDE 深度评测与选型建议',
      'AI 笔记工具横评：NotebookLM、Mem、Reflect 该选谁',
      '用 AI 做 PPT：Gamma、Tome、Beautiful.ai 实战对比',
      'AI 视频生成工具入门：从文字到视频的完整流程',
      'AI 设计工具进阶：Midjourney 高级 Prompt 技巧',
      'AI 代码审查工具：提升代码质量的秘密武器',
      '免费 AI 工具大合集：不花钱也能玩转 AI',
      'AI 写作助手实测：哪款最适合中文写作',
      'AI 搜索工具对比：Perplexity、秘塔、天工谁更好用',
      'AI 思维导图工具：让头脑风暴更高效',
      'AI 翻译工具深度评测：专业场景该选谁',
      'AI 音频处理工具：降噪、转写、配乐一站式',
      '用 AI 管理知识：从信息收集到知识内化',
      'AI 效率工作流：5 个自动化场景实战',
    ],
  },
  {
    key: 'llm',
    authorName: '大模型研究员',
    categorySlug: 'llm',
    tagline: '大语言模型技术、应用与微调实践',
    promptHint: '大模型技术：围绕大语言模型的技术原理、应用实践、微调方法或行业落地，写一篇包含原理、代码/配置示例和实战经验的技术文章',
    discussionQuestion: '你在大模型应用中遇到过什么挑战？欢迎分享你的方案、调参经验或不同模型的对比测试结果。',
    defaultTags: ['大模型', 'LLM'],
    persona: { name: 'LLMResearcher', owner: 'Gitd Community', desc: '大模型技术爱好者，专注 LLM 应用与微调实践' },
    topics: [
      '大模型 RAG 实战：从 0 到 1 搭建知识库问答',
      'Prompt Engineering 进阶：让大模型输出更精准',
      'LangChain vs LlamaIndex：RAG 框架怎么选',
      '大模型微调入门：LoRA、QLoRA 原理解析',
      '向量数据库选型：Pinecone、Milvus、Chroma 对比',
      '大模型 Function Calling 实战：让 AI 调用工具',
      'Agent 框架对比：AutoGPT、CrewAI、LangGraph',
      '大模型上下文窗口：为什么越长不一定越好',
      'Embedding 模型选型：语义搜索的核心',
      '大模型幻觉问题：原因分析与缓解策略',
      '开源大模型横评：Llama、Qwen、DeepSeek 对比',
      '大模型量化技术：4-bit、8-bit 推理实战',
      'RAG 优化技巧：从召回率到答案质量',
      '大模型 API 成本优化：缓存、批处理与降级策略',
      '多模态大模型：图文理解的技术原理与应用',
    ],
  },
  {
    key: 'ai-agent',
    authorName: 'Agent架构师',
    categorySlug: 'ai-agent',
    tagline: 'AI Agent 架构、框架与开发实践',
    promptHint: 'AI Agent 开发：围绕 AI Agent 的架构设计、框架使用、开发技巧或落地案例，写一篇包含架构图描述、代码示例和实战经验的技术文章',
    discussionQuestion: '你在做 AI Agent 开发吗？欢迎分享你的架构设计、踩坑记录或更好的实践方案。',
    defaultTags: ['AIAgent', '智能体'],
    persona: { name: 'AgentArchitect', owner: 'Gitd Community', desc: 'AI Agent 架构师，专注智能体设计与开发实践' },
    topics: [
      'AI Agent 核心概念：从 ReAct 到 Plan-and-Execute',
      'CrewAI 实战：构建多 Agent 协作系统',
      'LangGraph 入门：用状态图构建复杂 Agent',
      'AI Agent 记忆系统设计：短期记忆与长期记忆',
      'Agent 工具调用：从 Function Calling 到 MCP',
      '多 Agent 协作模式：顺序、并行与层级',
      'AI Agent 评测：如何衡量智能体的能力',
      'AutoGPT 之后：自主 Agent 的演进方向',
      '用 AI Agent 做代码审查：架构与实现',
      'Agent 安全：防止 Prompt 注入的 5 种方法',
      'AI Agent 与 RAG 结合：知识增强的智能体',
      'Agent 任务规划：让 AI 学会拆解问题',
      '人机协作 Agent：AI 辅助决策的设计模式',
      'AI Agent 监控与可观测性建设',
      '从 Copilot 到 Agent：开发工具的 AI 演进',
    ],
  },
  {
    key: 'prompt',
    authorName: 'Prompt工程师',
    categorySlug: 'prompt',
    tagline: 'Prompt 设计技巧、模板与最佳实践',
    promptHint: 'Prompt 工程：分享实用的 Prompt 设计技巧、模板、优化方法或不同场景的最佳实践，包含原理分析、具体示例和效果对比',
    discussionQuestion: '你有什么好用的 Prompt 技巧？欢迎在评论区分享你的模板和使用心得。',
    defaultTags: ['Prompt', '提示词'],
    persona: { name: 'PromptEngineer', owner: 'Gitd Community', desc: 'Prompt 工程师，擅长提示词设计与优化' },
    topics: [
      'Prompt 工程入门：5 个核心原则与实战',
      'Zero-shot、Few-shot、Chain-of-Thought 对比',
      '结构化输出 Prompt：让大模型返回 JSON 的技巧',
      '角色设定 Prompt 模板：10 个高频场景',
      '长文本处理 Prompt：摘要、提取与分类技巧',
      'Prompt 优化方法论：从"能用"到"好用"',
      '翻译 Prompt 进阶：专业级翻译的提示词设计',
      '写作 Prompt 模板：从大纲到成稿的完整流程',
      '代码生成 Prompt 技巧：写出高质量代码的秘诀',
      '批判性思维 Prompt：让 AI 帮你分析问题',
      'Prompt 反优化：常见的错误写法与修正方法',
      '多轮对话 Prompt 设计：保持上下文一致性',
      '创意写作 Prompt：激发 AI 的创造力',
      '数据分析 Prompt：让 AI 帮你解读数据',
      'Prompt 模板库：20 个日常高频场景',
    ],
  },
];

// ===== 动态主题生成 =====
async function generateNewTopics(bot, count = 5) {
  const prompt = buildTopicGenerationPrompt({ bot, recentTopics: bot.topics.slice(0, 5) });

  try {
    const content = await callAI({
      prompt,
      systemPrompt: '你是技术社区内容策划，专门负责生成高质量的文章主题。只输出 JSON 数组。',
      maxTokens: 1000,
      responseFormat: { type: 'json_object' },
      tag: TAG,
    });

    const parsed = robustJSONParse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter(t => typeof t === 'string' && t.length > 5);
    }
    if (Array.isArray(parsed.topics)) return parsed.topics;
    warn('动态主题生成返回格式异常，使用固定主题池');
  } catch (e) {
    warn(`动态主题生成失败：${e.message}，使用固定主题池`);
  }

  return [];
}

// ===== 选择主题（带去重） =====
async function pickTopic(bot, recentPostTitles = []) {
  // 30% 概率使用动态生成的新主题
  const useDynamic = Math.random() < 0.3;

  let candidates = [...bot.topics];

  if (useDynamic) {
    log('尝试动态生成新主题...');
    const newTopics = await generateNewTopics(bot, 5);
    if (newTopics.length > 0) {
      candidates = [...newTopics, ...candidates];
      log(`生成了 ${newTopics.length} 个新主题`);
    }
  }

  // 从候选中选一个和最近帖子标题不重复的
  const topic = pickDiverseTopic(candidates, recentPostTitles, 0.4);
  return topic;
}

// ===== 获取近期帖子标题（用于去重）=====
async function fetchRecentPostTitles(token, categorySlug, limit = 10) {
  try {
    const res = await siteFetch(`${SITE_URL}/api/forum/posts?category=${categorySlug}&limit=${limit}&sort=newest`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts || []).map(p => p.title).filter(Boolean);
  } catch {
    return [];
  }
}

// ===== 注册 AI Agent =====
async function registerAIAgent(persona) {
  const suffix = Math.floor(Math.random() * 900 + 100);
  const agentName = `${persona.name}${suffix}`;

  log(`尝试注册 AI Agent：${agentName}...`);
  try {
    const res = await siteFetch(`${SITE_URL}/api/ai-agent/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_name: agentName,
        agent_owner: persona.owner,
        agent_description: persona.desc,
      }),
    }, 15000);

    if (res.ok) {
      const data = await res.json();
      log(`AI Agent 注册成功：${data.user?.username}`);
      return data.token;
    }

    if (res.status === 403 || res.status === 429) {
      log('AI Agent 注册限额已满，回退到管理员账号');
      return null;
    }

    if (res.status === 409) {
      log('用户名已存在，重试...');
      return registerAIAgent(persona);
    }

    warn(`AI Agent 注册失败：${res.status}`);
    return null;
  } catch (error) {
    warn(`AI Agent 注册异常：${error?.message || error}`);
    return null;
  }
}

// ===== 登录 =====
async function login() {
  const LOGIN_MAX_RETRIES = 2;
  const LOGIN_RETRY_DELAY_MS = 3000;

  for (let attempt = 0; attempt <= LOGIN_MAX_RETRIES; attempt++) {
    try {
      log(`登录 ${SITE_URL}...（第 ${attempt + 1} 次尝试）`);
      const res = await siteFetch(`${SITE_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        if (attempt < LOGIN_MAX_RETRIES) {
          warn(`登录失败：${res.status}，${LOGIN_RETRY_DELAY_MS}ms 后重试...`);
          await sleep(LOGIN_RETRY_DELAY_MS);
          continue;
        }
        throw new Error(`登录失败：${res.status} ${text.slice(0, 300)}`);
      }

      const data = await res.json();
      if (!data.token) throw new Error('登录返回中没有 token');
      log(`登录成功，用户：${data.user?.username}`);
      return data.token;
    } catch (error) {
      const msg = error?.name === 'AbortError' ? `登录超时` : (error?.message || error);
      if (attempt < LOGIN_MAX_RETRIES) {
        warn(`${msg}，${LOGIN_RETRY_DELAY_MS}ms 后重试...`);
        await sleep(LOGIN_RETRY_DELAY_MS);
        continue;
      }
      throw new Error(`登录失败（已重试 ${LOGIN_MAX_RETRIES + 1} 次）：${msg}`);
    }
  }
}

// ===== 获取分类列表 =====
async function fetchCategories(token) {
  const res = await siteFetch(`${SITE_URL}/api/forum/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    warn(`获取分类失败：${res.status}`);
    return [];
  }

  const data = await res.json();
  return Array.isArray(data) ? data : (Array.isArray(data.categories) ? data.categories : []);
}

function findCategoryIdBySlug(categories, slug) {
  if (!categories || categories.length === 0) return null;
  const bySlug = categories.find((c) => c.slug === slug);
  if (bySlug) return bySlug.id;
  warn(`未找到 slug 为 "${slug}" 的分类，尝试按名称匹配...`);
  const byName = categories.find((c) =>
    c.name && c.name.toLowerCase().includes(slug.toLowerCase()));
  if (byName) return byName.id;
  return null;
}

// ===== 自动修复内容问题 =====
// 修复 AI 生成内容常见的截断问题：代码块不闭合、句子截断等
function autoFixContent(content) {
  if (!content || typeof content !== 'string') return content;

  let fixed = content;

  // 1. 修复未闭合的代码块（奇数个 ``` 说明最后一个没闭合）
  const codeFenceCount = (fixed.match(/```/g) || []).length;
  if (codeFenceCount % 2 !== 0) {
    // 找到最后一个代码块的位置
    const lastFenceIndex = fixed.lastIndexOf('```');
    const afterFence = fixed.slice(lastFenceIndex + 3);
    // 如果最后一个代码块后面内容很少，说明被截断了，直接闭合
    if (afterFence.trim().length < 200) {
      // 去掉不完整的尾部，闭合代码块
      fixed = fixed.slice(0, lastFenceIndex + 3) + '\n';
    } else {
      // 后面内容较多，可能是新的代码块没写完，补一个闭合
      fixed = fixed + '\n```\n';
    }
  }

  // 2. 去掉末尾明显不完整的句子（以逗号、顿号、"和"、"与"、"例如"等结尾）
  const incompleteEndings = [
    /[,，、]$/, /和$/, /与$/, /例如$/, /比如$/, /以及$/,
    /包括$/, /：$/, /:$/, /—$/, /- \d+.$/, /\d+\.$/,
    /- \w+$/, /\($/, /（$/, /\[.*$/, /【.*$/
  ];

  let lines = fixed.trim().split('\n');
  // 只处理最后一行普通文本（非代码块内的）
  let inCodeBlock = false;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock && line.length > 0) {
      // 检查最后一行是否不完整
      let isIncomplete = false;
      for (const pattern of incompleteEndings) {
        if (pattern.test(line)) {
          isIncomplete = true;
          break;
        }
      }
      if (isIncomplete) {
        // 去掉最后一行不完整的
        lines = lines.slice(0, i);
      }
      break;
    }
  }
  fixed = lines.join('\n');

  return fixed.trim();
}

// ===== 调用 AI 生成帖子（多样化版本 + 多种内容类型）=====
async function generatePostContent(bot, title, categories, angle, contentType = 'normal', extraMeta = {}) {
  const categoryNames = categories.map((c) => c.name).join('、') || '综合讨论';

  // 根据内容类型选择结构模板
  let structure;
  let lengthRange;
  let typeName = '普通文章';
  const contentTypeTemplate = getContentTypeTemplate(contentType);

  if (contentTypeTemplate) {
    structure = { name: contentTypeTemplate.typeName, structure: contentTypeTemplate.structure };
    lengthRange = contentTypeTemplate.lengthRange;
    typeName = contentTypeTemplate.typeName;
  } else {
    const { meta } = buildDiversePromptRules({ mode: 'deep', botPersona: bot.authorName, topic: title });
    structure = meta.structure;
    lengthRange = meta.structure.lengthRange;
  }

  // 构建通用的多样化规则（风格、开头、结尾、讨论问题）
  const { rules, meta: baseMeta } = buildDiversePromptRules({ mode: 'deep', botPersona: bot.authorName, topic: title });

  // 系列文章特殊处理
  let seriesIntro = '';
  let extraTags = [];
  if (contentType === 'series' && extraMeta.seriesInfo) {
    const prefix = buildSeriesPrefix(extraMeta.seriesInfo);
    seriesIntro = prefix.intro;
    extraTags = prefix.tags;
  }

  // 新闻速递特殊提示
  let typeSpecificHint = '';
  if (contentType === 'news-digest') {
    typeSpecificHint = `
## 新闻速递特别要求

1. 内容聚焦 AI 领域最近一周的重要动态
2. 每条新闻要有明确的信息来源感（如"据 X 报道""官方发布"等表述），但不要编造具体来源链接
3. 新闻要分类清晰，每个分类下 2-5 条
4. 每条新闻要有简要解读，不只是标题堆砌
5. 一句话速览部分每条控制在 20 字以内
6. 不要编造不存在的公司、产品或数据`;
  } else if (contentType === 'cheatsheet') {
    typeSpecificHint = `
## 速查表特别要求

1. 内容要实用、精炼，方便快速查阅
2. 基础语法部分必须用 Markdown 表格形式呈现
3. 每个知识点要简洁明了，不要长篇大论
4. 常见问题部分用 FAQ 形式，问题要典型
5. 实用工具部分推荐真实存在的工具`;
  } else if (contentType === 'comparison') {
    typeSpecificHint = `
## 对比评测特别要求

1. 对比至少 2-3 个主流方案/工具
2. 对比维度要全面（功能、性能、易用性、生态、价格等）
3. 横向对比表必须是标准的 Markdown 表格
4. 选型建议要分场景给出，不要只说哪个好
5. 对比要客观中立，不要明显偏向某一方`;
  } else if (contentType === 'case-study') {
    typeSpecificHint = `
## 案例拆解特别要求

1. 选择一个真实可信的项目场景作为案例
2. 技术架构要描述清楚，有整体感
3. 关键实现部分要有完整代码示例
4. 踩过的坑要具体，有实际参考价值
5. 效果与反思要有数据或具体结论，不要空泛`;
  }

  const prompt = `你是一个技术社区的内容创作者，人设是「${bot.authorName}」，专注${bot.tagline}。请生成一篇高质量的论坛帖子。

## 要求

1. 标题：${title}
2. 内容类型：${typeName}
3. 类型：${bot.promptHint}
4. 内容用 Markdown 格式，结构清晰。
5. 文章长度约 ${lengthRange[0]}-${lengthRange[1]} 字。
6. 语言：中文。
7. 切入角度：${angle}
8. 要有实际价值，不要空洞的水文。
9. 帖子要像高质量技术社区内容一样专业、清晰、可复现，优先保证技术准确性和实践价值。
10. 不要写"作为 AI""我是 AI"之类表达。
11. 文章结构类型：${structure.name}

## 代码块要求（非常重要）

涉及代码、命令、配置、JSON 等内容时，**必须使用 Markdown 代码块包裹**，并指定正确的语言类型：

- JavaScript/TypeScript 代码用 \`\`\`javascript 或 \`\`\`typescript
- Python 代码用 \`\`\`python
- Shell 命令用 \`\`\`bash
- JSON/YAML 配置用 \`\`\`json 或 \`\`\`yaml
- HTML/CSS 用 \`\`\`html 或 \`\`\`css
- SQL 用 \`\`\`sql

代码块使用规范：
1. 代码要完整可运行，不要只写片段让读者猜
2. 关键代码要加注释说明
3. 命令行示例要说明执行效果或预期输出
4. 配置文件要说明放在哪个位置、如何使用
5. 技术类文章至少包含 1-2 个有价值的代码示例

${typeSpecificHint}

${rules}

## 输出格式

只输出一个 JSON 对象，不要输出任何其他文字，不要用 markdown 代码块包裹：
{
  "title": "专业、清晰、适合 SEO 的帖子标题",
  "content": "Markdown 格式的帖子正文，注意：正文中的换行用 \\\\n 表示，代码块用三个反引号包裹",
  "tags": ["标签1", "标签2", "标签3", "标签4"],
  "postType": "discussion",
  "summary": "一句话总结这篇帖子"
}

论坛现有分类：${categoryNames}
本帖目标分类 slug：${bot.categorySlug}（${bot.tagline}）。如果分类里有对应的就推荐一个分类名（放在 categoryId 字段，用分类的 id），没有合适的就不填。`;

  log(`调用 AI 生成帖子：${title}（${typeName} / ${baseMeta.style.name} / ${angle}）`);

  let lastError = null;
  for (let attempt = 0; attempt <= AI_GENERATE_RETRIES; attempt++) {
    const content = await callAI({
      prompt,
      systemPrompt: `你是技术社区内容创作者「${bot.authorName}」，擅长${bot.tagline}。必须只输出一个有效的 JSON 对象，不要包含任何 markdown 代码块标记或其他文字。`,
      maxTokens: Math.floor(lengthRange[1] * 4.5),
      responseFormat: { type: 'json_object' },
      tag: TAG,
    });

    try {
      const parsed = robustJSONParse(content);
      if (parsed.title && parsed.content) {
        parsed.title = normalizeTitle(parsed.title, title);
        // 合并额外标签（系列标签等）
        const allTags = [...(parsed.tags || []), ...extraTags];
        parsed.tags = normalizeTags(allTags, bot.defaultTags);
        // 自动修复常见的内容问题
        parsed.content = autoFixContent(parsed.content);
        // 系列文章加引言
        if (seriesIntro) {
          parsed.content = seriesIntro + '\n' + parsed.content;
        }
        parsed.content = appendProfessionalFooter(parsed.content, {
          discussionQuestion: baseMeta.discussion,
        });
        assertGeneratedPostQuality(parsed);
        log(`帖子生成完成，标题：${parsed.title}，内容长度：${parsed.content?.length || 0}，类型：${typeName}`);
        return parsed;
      }
      warn(`AI 返回的 JSON 缺少 title 或 content（第 ${attempt + 1} 次）`);
    } catch (parseError) {
      warn(`JSON 解析失败（第 ${attempt + 1} 次）：${parseError.message}`);
      log(`AI 返回内容前300字符：${content.slice(0, 300)}`);
    }

    lastError = new Error('JSON 解析失败');

    if (attempt === AI_GENERATE_RETRIES) {
      warn('JSON 解析多次失败，尝试从文本中提取帖子内容...');
      const fallback = extractPostFromText(content, title);
      if (fallback.title && fallback.content && fallback.content.length > 50) {
        fallback.title = normalizeTitle(fallback.title, title);
        const allTags = [...(fallback.tags || []), ...extraTags];
        fallback.tags = normalizeTags(allTags, bot.defaultTags);
        fallback.content = autoFixContent(fallback.content);
        if (seriesIntro) {
          fallback.content = seriesIntro + '\n' + fallback.content;
        }
        fallback.content = appendProfessionalFooter(fallback.content, {
          discussionQuestion: baseMeta.discussion,
        });
        assertGeneratedPostQuality(fallback);
        log(`兜底提取成功，标题：${fallback.title}，内容长度：${fallback.content.length}`);
        return fallback;
      }
    }
  }

  throw new Error(`AI 生成帖子内容失败（已重试 ${AI_GENERATE_RETRIES + 1} 次）：${lastError?.message || '未知错误'}`);
}

// ===== 发布帖子 =====
async function publishPost(token, bot, postData, categories) {
  const categoryId = findCategoryIdBySlug(categories, bot.categorySlug);
  if (!categoryId) {
    warn(`分类 "${bot.categorySlug}" 未匹配到 categoryId，将不指定分类发布`);
  }

  const body = {
    title: normalizeTitle(postData.title),
    content: postData.content,
    postType: postData.postType || 'discussion',
    isAIGenerated: true,
    authorName: bot.authorName,
  };

  if (categoryId) body.categoryId = categoryId;
  if (Array.isArray(postData.tags) && postData.tags.length > 0) {
    body.tags = normalizeTags(postData.tags);
  }

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await siteFetch(`${SITE_URL}/api/forum/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      log(`发帖成功：${data.post?.title || postData.title}（${SITE_URL}/post/${data.post?.id}）`);
      return data.post;
    }

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const waitMs = 65000;
      warn(`触发限流，等待 ${waitMs / 1000}s 后重试...`);
      await sleep(waitMs);
      continue;
    }

    const text = await res.text().catch(() => '');
    throw new Error(`发帖失败：${res.status} ${text.slice(0, 200)}`);
  }
}

// ===== 主流程 =====
async function main() {
  log('开始执行 AI 分类机器人自动发帖（深度优化版）...');
  log(`模式：${DRY_RUN ? '预览（dry-run）' : '正式发帖'}`);
  log(`机器人数量：${BOTS.length}`);

  let token = null;
  let categories = [];

  if (!DRY_RUN) {
    token = await login();
    if (!token) fail('无法获取有效 token');
    categories = await fetchCategories(token);
    log(`获取到 ${categories.length} 个分类`);
  }

  const results = { success: 0, failed: 0, skipped: 0 };
  const failedBots = [];

  const selectedBots = selectBotsForRun(BOTS);
  log(`内容策略：本次运行 ${selectedBots.length} 个机器人 - ${selectedBots.map(b => b.authorName).join('、')}`);

  for (const bot of selectedBots) {
    log(`\n========== [${bot.authorName}] ==========`);

    // 获取近期帖子标题用于去重
    let recentTitles = [];
    if (!DRY_RUN) {
      recentTitles = await fetchRecentPostTitles(token, bot.categorySlug, 8);
      log(`近期已发布 ${recentTitles.length} 篇，将进行内容去重`);
    }

    // 选择主题（带去重）
    const topic = await pickTopic(bot, recentTitles);
    log(`选中主题：${topic}`);

    // 随机选择内容切入角度
    const angle = getRandomContentAngle();
    log(`切入角度：${angle}`);

    // 随机选择内容类型
    const contentType = pickRandomContentType();
    log(`内容类型：${contentType}`);

    // 系列文章特殊处理
    let extraMeta = {};
    let finalTopic = topic;
    if (contentType === 'series') {
      const seriesInfo = getRandomSeriesTopic(recentTitles);
      if (seriesInfo) {
        extraMeta.seriesInfo = seriesInfo;
        finalTopic = seriesInfo.part.title;
        log(`系列文章：${seriesInfo.series.name} 第 ${seriesInfo.partIndex + 1} 篇`);
      }
    }

    try {
      const postData = await generatePostContent(bot, finalTopic, categories, angle, contentType, extraMeta);

      if (DRY_RUN) {
        log(`[预览模式] 标题：${postData.title}`);
        log(`[预览模式] 标签：${postData.tags?.join(', ') || '无'}`);
        log(`[预览模式] 内容长度：${postData.content?.length || 0}`);
        log(`[预览模式] 摘要：${postData.summary || postData.content?.slice(0, 100)}`);
        results.success++;
      } else {
        let botToken = null;
        try {
          botToken = await registerAIAgent(bot.persona);
        } catch (e) {
          warn(`注册 AI Agent 出错，使用管理员账号：${e.message}`);
        }

        if (!botToken) {
          botToken = token;
          log('使用管理员账号发帖');
        }

        await publishPost(botToken, bot, postData, categories);
        results.success++;

        if (bot !== selectedBots[selectedBots.length - 1]) {
          await sleep(3000);
        }
      }
    } catch (error) {
      warn(`机器人 [${bot.authorName}] 执行失败：${error.message}`);
      results.failed++;
      failedBots.push({ bot: bot.key, error: error.message });
    }
  }

  log(`\n========== 执行结果 ==========`);
  log(`成功：${results.success}，失败：${results.failed}`);
  if (failedBots.length > 0) {
    log('失败详情：');
    for (const fb of failedBots) {
      log(`  - ${fb.bot}: ${fb.error}`);
    }
  }

  if (results.failed > 0 && results.success === 0) {
    fail('所有机器人均执行失败');
  }
}

main().catch((error) => {
  fail(`执行异常：${error.message}`);
});
