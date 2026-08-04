#!/usr/bin/env node

/**
 * 自动内容创作脚本
 * 通过 SITE_URL API 登录，获取论坛分类列表，
 * 调用 AI 生成高质量技术博客文章（比普通论坛帖子更长更深入），
 * 通过 API 发布到论坛。
 *
 * 帖子类型（交替进行）：
 *   - tutorial: 深度技术教程
 *   - blog:     项目实战分享
 *   - trend:    技术趋势分析
 *
 * 用法：在 GitHub Actions 中运行
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL, POST_TOPIC, AUTHOR_NAME
 */

import { callAI, checkAIHealth, siteFetch } from './lib/ai-client.mjs';
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
  POST_TOPIC = '', // tutorial | blog | trend | random
  AUTHOR_NAME = 'GitdBot', // AI 发帖时显示的自定义作者名，默认不用 admin
} = process.env;

const TAG = '[auto-content-creator]';

function log(message) { console.log(`${TAG} ${message}`); }
function fail(message) { console.error(`::error::${TAG} ${message}`); process.exit(1); }

if (!ADMIN_PASSWORD) fail('缺少 ADMIN_PASSWORD');
if (!SITE_URL) fail('缺少 SITE_URL');

// ===== 帖子类型定义 =====
const POST_TYPES = {
  tutorial: {
    label: '深度技术教程',
    hint: '写一篇深度技术教程，需要系统讲解某个技术主题，包含原理剖析、完整代码示例、分步骤说明、常见坑点和最佳实践。内容要有深度，面向中高级开发者。',
    topics: [
      'Next.js App Router 服务端组件与数据获取深度解析',
      'Prisma ORM 事务、关联查询与性能优化实战',
      'TypeScript 高级类型：泛型、条件类型与类型推断详解',
      'React Server Components 渲染机制与状态管理',
      'PostgreSQL 索引原理与查询性能调优',
      'JWT 认证体系设计：Access Token 与 Refresh Token 实践',
      'Tailwind CSS 设计系统搭建与主题定制',
      'GitHub Actions 复杂工作流编排与复用机制',
    ],
  },
  blog: {
    label: '项目实战分享',
    hint: '写一篇项目实战分享文章，以真实项目开发经历为线索，讲解架构设计、技术选型、踩坑过程和解决方案。要有真实场景感和可借鉴的经验总结。',
    topics: [
      '从零搭建开发者社区平台：全栈架构设计与实现',
      '使用 Next.js + Prisma 构建内容管理系统的实战经验',
      '开源 SaaS 产品授权系统的设计与落地',
      '基于 GitHub API 的自动化协作工具开发实践',
      '论坛系统的高并发优化与缓存策略实战',
      '全栈 TypeScript 项目的工程化最佳实践',
      '从单体到模块化：前端架构演进之路',
    ],
  },
  trend: {
    label: '技术趋势分析',
    hint: '写一篇技术趋势分析文章，深入分析当前和未来的技术发展方向，结合数据、案例和行业动态，给出有洞察力的观点和建议。',
    topics: [
      '2026 年前端框架趋势：React Server Components 的普及与影响',
      'AI 辅助编程工具的现状与未来发展方向',
      'Edge Computing 与边缘渲染：下一代 Web 性能优化',
      'TypeScript 生态演进与类型系统发展趋势',
      '开源社区与商业化：可持续发展的平衡之道',
      'WebAssembly 在服务端的应用前景分析',
    ],
  },
};

const TYPE_KEYS = ['tutorial', 'blog', 'trend'];

// ===== 选择帖子类型（支持交替） =====
function pickPostType() {
  let type = POST_TOPIC;

  if (!type || type === 'random' || !POST_TYPES[type]) {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    type = TYPE_KEYS[dayOfYear % TYPE_KEYS.length];
  }

  const config = POST_TYPES[type];
  const title = config.topics[Math.floor(Math.random() * config.topics.length)];
  return { type, label: config.label, hint: config.hint, title };
}

// ===== AI Agent 人设池 =====
const AGENT_PERSONAS = [
  { name: 'CodeNinja', owner: 'Gitd Community', desc: '热爱全栈开发，专注 React 和 Node.js' },
  { name: 'DevExplorer', owner: 'Gitd Community', desc: '探索新技术，分享开发经验和工具' },
  { name: 'ByteWizard', owner: 'Gitd Community', desc: '后端架构师，擅长分布式系统' },
  { name: 'PixelMage', owner: 'Gitd Community', desc: '前端开发者，热爱 CSS 动画和 UX 设计' },
  { name: 'CloudPilot', owner: 'Gitd Community', desc: '云原生和 DevOps 实践者' },
  { name: 'DataMiner', owner: 'Gitd Community', desc: '数据工程师，热爱 Python 和 ML' },
  { name: 'TechSage', owner: 'Gitd Community', desc: '资深开发者，擅长系统设计' },
  { name: 'WebCraftsman', owner: 'Gitd Community', desc: 'Web 工匠，追求代码质量和性能' },
];

// ===== 注册 AI Agent 并获取 token =====
async function registerAIAgent() {
  const persona = AGENT_PERSONAS[Math.floor(Math.random() * AGENT_PERSONAS.length)];
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
      log(`AI Agent 注册成功：${data.user?.username}，使用该账号发帖`);
      return data.token;
    }

    if (res.status === 403 || res.status === 429) {
      log('AI Agent 注册限额已满，回退到管理员账号');
      return null;
    }

    if (res.status === 409) {
      log('用户名已存在，重试...');
      return registerAIAgent();
    }

    log(`AI Agent 注册失败：${res.status}`);
    return null;
  } catch (error) {
    log(`AI Agent 注册异常：${error?.message || error}`);
    return null;
  }
}

// ===== 登录 =====
async function login() {
  log(`登录 ${SITE_URL}...`);
  const res = await siteFetch(`${SITE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    fail(`登录失败：${res.status} ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data.token) fail('登录返回中没有 token');
  log(`登录成功，用户：${data.user?.username}`);
  return data.token;
}

// ===== 获取论坛分类列表 =====
async function fetchCategories(token) {
  const res = await siteFetch(`${SITE_URL}/api/forum/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    log(`获取分类失败：${res.status}`);
    return [];
  }

  const data = await res.json();
  const categories = Array.isArray(data) ? data : (Array.isArray(data.categories) ? data.categories : []);
  log(`获取到 ${categories.length} 个分类`);
  return categories;
}

// ===== 解析标签分隔格式 =====
function parseTaggedOutput(text) {
  const result = {};

  // 提取单行字段：title, postType, categoryId, summary
  const singleLineFields = ['title', 'postType', 'categoryId', 'summary'];
  for (const field of singleLineFields) {
    const re = new RegExp(`<${field}>\\s*([\\s\\S]*?)\\s*</${field}>`, 'i');
    const m = text.match(re);
    if (m) result[field] = m[1].trim();
  }

  // 提取多行字段：content（允许包含任意字符）
  const contentMatch = text.match(/<content>\s*([\s\S]*?)<\/content>/i);
  if (contentMatch) result.content = contentMatch[1].trim();

  // 提取 tags：逗号分隔
  const tagsMatch = text.match(/<tags>\s*([\s\S]*?)\s*<\/tags>/i);
  if (tagsMatch) {
    result.tags = tagsMatch[1]
      .split(/[,，、]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 20)
      .slice(0, 5);
  }

  return result;
}

// ===== 调用 AI 生成高质量文章 =====
async function generateArticle(postType, title, categories) {
  const categoryList = categories.map((c) => `${c.id}:${c.name}`).join('、') || '无';
  const professionalRules = buildProfessionalPromptRules({ mode: 'deep' });

  const prompt = `你是一位资深技术博主和全栈开发工程师。请生成一篇高质量的深度技术博客文章。

## 文章要求

1. 标题：${title}
2. 类型：${postType.label} —— ${postType.hint}
3. 内容用 Markdown 格式，结构清晰，包含：
   - 核心结论（开头 2-3 句话直接说明价值）
   - 适合读者
   - 背景/问题介绍
   - 核心内容（分多个小节，每节有明确的小标题）
   - 完整的、可运行的代码示例（用代码块包裹，标注语言）
   - 实际案例或对比分析
   - 常见坑点
   - 总结与最佳实践建议
   - 讨论引导
4. 内容长度：2500-6000 字（要深入、有料，不是水文）。
5. 语言：中文，技术术语可保留英文。
6. 代码示例必须正确、可运行，符合当前主流版本的最佳实践。
7. 要有独到见解和实用价值，能让读者真正学到东西。
8. 适当使用表格、列表、引用块来增强可读性。
9. 不要写“作为 AI”“我是 AI”之类表达。

${professionalRules}

## 论坛分类

现有分类：${categoryList}
如果分类里有合适的就推荐一个（放在 categoryId 标签中，填分类的 id），没有合适的就留空。

## 输出格式

用以下标签格式输出，每个字段用对应标签包裹。content 标签内可以直接写 Markdown，不需要转义任何字符：

<TITLE>专业、清晰、适合 SEO 的文章标题</TITLE>

<CONTENT>
Markdown 格式的完整文章正文
</CONTENT>

<TAGS>标签1,标签2,标签3,标签4,标签5</TAGS>

<POSTTYPE>discussion</POSTTYPE>

<CATEGORYID>分类ID或留空</CATEGORYID>

<SUMMARY>一句话总结这篇文章</SUMMARY>`;

  log(`调用 AI 生成文章...`);
  log(`类型：${postType.label}，标题：${title}`);

  const content = await callAI({
    prompt,
    systemPrompt: '你是资深技术博主和全栈开发工程师，擅长写深度技术文章。你的文章结构清晰、代码规范、见解独到。严格按照标签格式输出，不要输出任何额外内容。',
    maxTokens: 16384,
    tag: TAG,
  });

  let parsed = parseTaggedOutput(content);

  if (!parsed.title || !parsed.content) {
    log(`解析失败，模型返回内容长度：${content.length}`);
    log(`内容开头（前 500 字符）：${content.slice(0, 500)}`);
    log(`内容结尾（后 300 字符）：${content.slice(-300)}`);
    fail('AI 返回内容缺少 title 或 content 字段');
  }

  if (parsed.title.length > 100) {
    parsed.title = parsed.title.slice(0, 97) + '...';
  }
  parsed.title = normalizeTitle(parsed.title, title);

  if (!parsed.postType) parsed.postType = 'discussion';
  parsed.tags = normalizeTags(parsed.tags, [postType.label, '技术文章']);
  if (!parsed.categoryId) parsed.categoryId = '';
  if (!parsed.summary) parsed.summary = '';
  parsed.content = appendProfessionalFooter(parsed.content, {
    discussionQuestion: '你在真实项目里是怎么处理类似问题的？欢迎补充你的技术选型、踩坑经历或不同方案。',
  });
  assertGeneratedPostQuality(parsed);

  log(`文章生成完成，标题：${parsed.title}，内容长度：${parsed.content.length}`);
  return parsed;
}

// ===== 发布文章到论坛 =====
async function publishPost(token, article, categories) {
  let categoryId = null;
  if (article.categoryId) {
    const matched = categories.find((c) => String(c.id) === String(article.categoryId));
    if (matched) categoryId = matched.id;
  }
  if (!categoryId && categories.length > 0) {
    categoryId = categories[0].id;
  }

  const body = {
    title: normalizeTitle(article.title),
    content: appendProfessionalFooter(article.content),
    postType: article.postType || 'discussion',
    isAIGenerated: true,
  };

  // 传递自定义作者名（仅管理员账号有效）
  if (AUTHOR_NAME) {
    body.authorName = AUTHOR_NAME;
  }

  if (categoryId) body.categoryId = categoryId;
  if (Array.isArray(article.tags) && article.tags.length > 0) {
    body.tags = normalizeTags(article.tags, [article.postType || '技术文章']);
  }
  assertGeneratedPostQuality({
    title: body.title,
    content: body.content,
    tags: body.tags || article.tags,
  });

  log(`发布文章到 ${SITE_URL}/api/forum/posts...`);

  const res = await siteFetch(`${SITE_URL}/api/forum/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    fail(`发布失败：${res.status} ${text.slice(0, 300)}`);
  }

  const result = await res.json();
  const postId = result.id || result.post?.id || '未知';
  log(`发布成功！帖子 ID：${postId}`);
  return result;
}

// ===== 主流程 =====
log('=== 自动内容创作任务开始 ===');

// 预检 AI API
const healthyModel = await checkAIHealth(TAG);
if (!healthyModel) fail('AI API 预检失败，所有模型均不可用');
log(`使用 AI 模型：${healthyModel}`);

const postType = pickPostType();
log(`本次文章类型：${postType.label}（${postType.type}）`);
log(`备选标题：${postType.title}`);
log(`作者名：${AUTHOR_NAME}`);

// 优先尝试用 AI Agent 账号发帖，注册失败再回退到管理员
let token = await registerAIAgent();
if (!token) {
  log('回退到管理员账号登录...');
  token = await login();
}
const categories = await fetchCategories(token);
const article = await generateArticle(postType, postType.title, categories);
const result = await publishPost(token, article, categories);

log(`完成！文章：${article.title}`);
log(`摘要：${article.summary || '无'}`);
