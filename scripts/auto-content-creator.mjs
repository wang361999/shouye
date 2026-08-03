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
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL, POST_TOPIC
 */

import { callAI, checkAIHealth, siteFetch, robustJSONParse } from './lib/ai-client.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
  POST_TOPIC = '', // tutorial | blog | trend | random
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

// ===== 调用 AI 生成高质量文章 =====
async function generateArticle(postType, title, categories) {
  const categoryNames = categories.map((c) => c.name).join('、') || '综合讨论';

  const prompt = `你是一位资深技术博主和全栈开发工程师。请生成一篇高质量的深度技术博客文章。

## 文章要求

1. 标题：${title}
2. 类型：${postType.label} —— ${postType.hint}
3. 内容用 Markdown 格式，结构清晰，包含：
   - 引言/背景介绍
   - 核心内容（分多个小节，每节有明确的小标题）
   - 完整的、可运行的代码示例（用代码块包裹，标注语言）
   - 实际案例或对比分析
   - 总结与最佳实践建议
4. 内容长度：2500-6000 字（要深入、有料，不是水文）。
5. 语言：中文，技术术语可保留英文。
6. 代码示例必须正确、可运行，符合当前主流版本的最佳实践。
7. 要有独到见解和实用价值，能让读者真正学到东西。
8. 适当使用表格、列表、引用块来增强可读性。

## 论坛分类

现有分类：${categoryNames}
如果分类里有合适的就推荐一个（放在 categoryId 字段，用分类的 id），没有合适的就留空。

## 输出格式

输出严格 JSON：
{
  "title": "文章标题",
  "content": "Markdown 格式的完整文章正文",
  "tags": ["标签1", "标签2", "标签3"],
  "postType": "discussion",
  "categoryId": "分类ID或空字符串",
  "summary": "一句话总结这篇文章"
}`;

  log(`调用 AI 生成文章...`);
  log(`类型：${postType.label}，标题：${title}`);

  const content = await callAI({
    prompt,
    systemPrompt: '你是资深技术博主和全栈开发工程师，擅长写深度技术文章。你的文章结构清晰、代码规范、见解独到。只输出严格 JSON。',
    maxTokens: 16384,
    responseFormat: { type: 'json_object' },
    tag: TAG,
  });

  let parsed;
  try {
    parsed = robustJSONParse(content);
  } catch (err) {
    log(`JSON 解析失败：${err.message}`);
    log(`模型返回内容长度：${content.length}`);
    log(`内容开头（前 500 字符）：${content.slice(0, 500)}`);
    log(`内容结尾（后 300 字符）：${content.slice(-300)}`);
    fail('AI 返回内容无法解析为 JSON');
  }

  if (!parsed.title || !parsed.content) {
    fail('AI 返回内容缺少 title 或 content 字段');
  }

  if (parsed.title.length > 100) {
    parsed.title = parsed.title.slice(0, 97) + '...';
  }

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
    title: article.title,
    content: article.content,
    postType: article.postType || 'discussion',
  };

  if (categoryId) body.categoryId = categoryId;
  if (Array.isArray(article.tags) && article.tags.length > 0) {
    body.tags = article.tags.slice(0, 5);
  }

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

const token = await login();
const categories = await fetchCategories(token);
const article = await generateArticle(postType, postType.title, categories);
const result = await publishPost(token, article, categories);

log(`完成！文章：${article.title}`);
log(`摘要：${article.summary || '无'}`);
