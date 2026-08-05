#!/usr/bin/env node

/**
 * AI 分类机器人自动发帖脚本
 * 管理四个 AI 机器人，每个负责一个 AI 分类（AI 工具 / 大模型 / Agent 开发 / Prompt 工程）。
 * 每次运行每个机器人生成并发布一篇帖子，共 4 篇。
 *
 * 用法：
 *   node scripts/auto-ai-bots.mjs            # 正式发帖
 *   node scripts/auto-ai-bots.mjs --dry-run  # 预览生成内容但不发布
 *
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL
 *   （AI 相关变量由 lib/ai-client.mjs 内部读取）
 */

import { callAI, siteFetch, robustJSONParse, extractPostFromText } from './lib/ai-client.mjs';
import {
  appendProfessionalFooter,
  assertGeneratedPostQuality,
  buildProfessionalPromptRules,
  normalizeTags,
  normalizeTitle,
} from './lib/post-template.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
} = process.env;

const TAG = '[auto-ai-bots]';
const DRY_RUN = process.argv.includes('--dry-run');
const AI_GENERATE_RETRIES = 2;

// ===== 内容策略配置 =====
// 每次运行发布的帖子数量（避免内容堆积）
const POSTS_PER_RUN = parseInt(process.env.POSTS_PER_RUN || '2', 10);

// 根据时间段选择不同类型的内容策略
function getTimeBasedSelection() {
  const hour = new Date().getUTCHours() + 8; // 北京时间
  // 早间档（8-10点）：工具类 + 干货教程
  if (hour >= 8 && hour < 11) return ['ai-tools', 'prompt'];
  // 午间档（14-16点）：深度技术 + 大模型
  if (hour >= 14 && hour < 17) return ['llm', 'ai-agent'];
  // 晚间档（20-22点）：综合轮换
  return null; // null 表示随机轮换
}

// 轮换选择本次要运行的机器人
function selectBotsForRun(bots) {
  const timeBased = getTimeBasedSelection();
  let selected;

  if (timeBased) {
    // 按时间段策略选择
    selected = bots.filter(b => timeBased.includes(b.key));
  } else {
    // 随机选择：基于日期哈希确保同一天同一时段选择相同的机器人
    const today = new Date().toISOString().slice(0, 10);
    const hour = new Date().getUTCHours() + 8;
    const period = Math.floor(hour / 6); // 0-3 四个时段
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

// 启动校验
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

function pickTopic(bot) {
  const pool = bot.topics;
  return pool[Math.floor(Math.random() * pool.length)];
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

// ===== 调用 AI 生成帖子 =====
async function generatePostContent(bot, title, categories) {
  const categoryNames = categories.map((c) => c.name).join('、') || '综合讨论';
  const promptRules = buildProfessionalPromptRules({ mode: 'forum' });

  const prompt = `你是一个技术社区的内容创作者，人设是「${bot.authorName}」，专注${bot.tagline}。请生成一篇高质量的论坛帖子。

## 要求

1. 标题：${title}
2. 类型：${bot.promptHint}
3. 内容用 Markdown 格式，结构清晰，必要时包含代码块。
4. 内容长度：1200-2400 字。
5. 语言：中文。
6. 要有实际价值，不要空洞的水文。
7. 代码示例或配置要正确可运行；如果涉及工具使用，要说明使用前提。
8. 帖子要像高质量技术社区教程一样专业、清晰、可复现，优先保证技术准确性和实践价值。
9. 不要写"作为 AI""我是 AI"之类表达。

${promptRules}

## 输出格式

只输出一个 JSON 对象，不要输出任何其他文字，不要用 markdown 代码块包裹：
{
  "title": "专业、清晰、适合 SEO 的帖子标题",
  "content": "Markdown 格式的帖子正文，注意：正文中的换行用 \\n 表示",
  "tags": ["标签1", "标签2", "标签3", "标签4"],
  "postType": "discussion",
  "summary": "一句话总结这篇帖子"
}

论坛现有分类：${categoryNames}
本帖目标分类 slug：${bot.categorySlug}（${bot.tagline}）。如果分类里有对应的就推荐一个分类名（放在 categoryId 字段，用分类的 id），没有合适的就不填。`;

  log(`调用 AI 生成帖子：${title}`);

  let lastError = null;
  for (let attempt = 0; attempt <= AI_GENERATE_RETRIES; attempt++) {
    const content = await callAI({
      prompt,
      systemPrompt: `你是技术社区内容创作者「${bot.authorName}」，擅长${bot.tagline}。必须只输出一个有效的 JSON 对象，不要包含任何 markdown 代码块标记或其他文字。`,
      maxTokens: 8000,
      responseFormat: { type: 'json_object' },
      tag: TAG,
    });

    try {
      const parsed = robustJSONParse(content);
      if (parsed.title && parsed.content) {
        parsed.title = normalizeTitle(parsed.title, title);
        parsed.tags = normalizeTags(parsed.tags, bot.defaultTags);
        parsed.content = appendProfessionalFooter(parsed.content, {
          discussionQuestion: bot.discussionQuestion,
        });
        assertGeneratedPostQuality(parsed);
        log(`帖子生成完成，标题：${parsed.title}，内容长度：${parsed.content?.length || 0}`);
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
        fallback.tags = normalizeTags(fallback.tags, bot.defaultTags);
        fallback.content = appendProfessionalFooter(fallback.content, {
          discussionQuestion: bot.discussionQuestion,
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
  log('开始执行 AI 分类机器人自动发帖...');
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

  // 根据内容策略选择本次要运行的机器人
  const selectedBots = selectBotsForRun(BOTS);
  log(`内容策略：本次运行 ${selectedBots.length} 个机器人 - ${selectedBots.map(b => b.authorName).join('、')}`);

  for (const bot of selectedBots) {
    log(`\n========== [${bot.authorName}] ==========`);
    const topic = pickTopic(bot);
    log(`选中主题：${topic}`);

    try {
      const postData = await generatePostContent(bot, topic, categories);

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

        // 每篇帖子间隔 2 秒
        if (bot !== BOTS[BOTS.length - 1]) {
          await sleep(2000);
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
