#!/usr/bin/env node

/**
 * 自动论坛发帖脚本
 * 调用 AI 生成开发教程或开源项目推荐帖子，通过 API 发布到论坛
 *
 * 用法：在 GitHub Actions 中运行
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL
 */

import { callAI, checkAIHealth, siteFetch, robustJSONParse } from './lib/ai-client.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
  POST_TOPIC = '', // tutorial | opensource | random
  AUTHOR_NAME = '', // AI 发帖时显示的自定义作者名
} = process.env;

const TAG = '[auto-forum-poster]';

function log(message) { console.log(`${TAG} ${message}`); }
function fail(message) { console.error(`::error::${TAG} ${message}`); process.exit(1); }

if (!ADMIN_PASSWORD) fail('缺少 ADMIN_PASSWORD');
if (!SITE_URL) fail('缺少 SITE_URL');

// ===== 论坛帖子主题池 =====
const TOPICS = {
  tutorial: [
    'Next.js 14 服务端组件入门指南',
    'Prisma ORM 数据库操作最佳实践',
    'TypeScript 类型体操实用技巧',
    'Tailwind CSS 响应式设计实战',
    'GitHub Actions CI/CD 自动化部署教程',
    'Vercel 免费部署 Next.js 项目全流程',
    'PostgreSQL 常用查询优化技巧',
    'React Server Components vs Client Components',
    'JWT 认证实现原理与安全实践',
    'Next.js 中间件 Middleware 使用指南',
    'bcrypt 密码哈希与安全存储',
    'API 路由设计 RESTful 最佳实践',
    '前端性能优化：图片懒加载与代码分割',
    'Git 分支管理策略与团队协作',
    'Docker 本地开发环境搭建',
  ],
  opensource: [
    '开源项目推荐：shadcn/ui — 可定制的前端组件库',
    '开源项目推荐：Prisma — 类型安全的 ORM',
    '开源项目推荐：Hono — 超快的 Web 框架',
    '开源项目推荐：Zod — TypeScript 优先的数据验证',
    '开源项目推荐：Bun — 全新的 JavaScript 运行时',
    '开源项目推荐：Tauri — 比 Electron 更轻量的桌面应用框架',
    '开源项目推荐：Astro — 内容驱动的新一代前端框架',
    '开源项目推荐：Drizzle ORM — 轻量级 TypeScript ORM',
    '开源项目推荐：Vite — 下一代前端构建工具',
    '开源项目推荐：TanStack Query — 数据请求管理利器',
    '开源项目推荐：Playwright — 跨浏览器端到端测试',
    '开源项目推荐：Biome — 一体化代码格式化与 lint 工具',
    '开源项目推荐：Htmx — 不用框架也能做动态页面',
    '开源项目推荐：Lucia Auth — 轻量认证库',
    '开源项目推荐：Better Stack — 日志监控免费方案',
  ],
};

function pickTopic() {
  let topicType = POST_TOPIC;
  if (!topicType || topicType === 'random') {
    topicType = Math.random() > 0.5 ? 'tutorial' : 'opensource';
  }
  const pool = TOPICS[topicType] || TOPICS.tutorial;
  const title = pool[Math.floor(Math.random() * pool.length)];
  return { topicType, title };
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

// ===== 获取分类 =====
async function fetchCategories(token) {
  const res = await siteFetch(`${SITE_URL}/api/forum/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    log(`获取分类失败：${res.status}`);
    return [];
  }

  const data = await res.json();
  return Array.isArray(data.categories) ? data.categories : [];
}

// ===== 健壮 JSON 解析已移至共享库 ai-client.mjs，直接导入使用 =====

// ===== 调用 AI 生成帖子内容 =====
async function generatePostContent(title, topicType, categories) {
  const categoryNames = categories.map((c) => c.name).join('、') || '综合讨论';
  const typeHint = topicType === 'tutorial'
    ? '开发教程：写一篇实用的技术教程，包含代码示例和步骤说明'
    : '开源项目推荐：介绍一个开源项目的特点、优势和使用场景';

  const prompt = `你是一个技术社区的内容创作者。请生成一篇高质量的论坛帖子。

## 要求

1. 标题：${title}
2. 类型：${typeHint}
3. 内容用 Markdown 格式，结构清晰，包含代码块。
4. 内容长度：800-2000 字。
5. 语言：中文。
6. 要有实际价值，不要空洞的水文。
7. 代码示例要正确可运行。
8. 帖子要有趣、易读，能吸引开发者。

## 输出格式

输出严格 JSON：
{
  "title": "帖子标题",
  "content": "Markdown 格式的帖子正文",
  "tags": ["标签1", "标签2", "标签3"],
  "postType": "discussion",
  "summary": "一句话总结这篇帖子"
}

论坛现有分类：${categoryNames}
如果分类里有合适的就推荐一个分类名（放在 categoryId 字段，用分类的 id），没有合适的就不填。`;

  log(`调用 AI 生成帖子：${title}`);

  const content = await callAI({
    prompt,
    systemPrompt: '你是技术社区内容创作者，擅长写高质量的编程教程和开源项目推荐文章。只输出严格 JSON。',
    maxTokens: 8000,
    responseFormat: { type: 'json_object' },
    tag: TAG,
  });

  const parsed = robustJSONParse(content);
  if (!parsed.title || !parsed.content) fail('AI 返回内容缺少 title 或 content');
  log(`帖子生成完成，标题：${parsed.title}，内容长度：${parsed.content?.length || 0}`);
  return parsed;
}

// ===== 发布帖子 =====
async function publishPost(token, postData, categories) {
  let categoryId = null;
  // 验证 AI 返回的 categoryId 是否真实存在，不存在则用第一个分类
  if (postData.categoryId && categories.some((c) => c.id === postData.categoryId)) {
    categoryId = postData.categoryId;
  } else if (categories.length > 0) {
    categoryId = categories[0].id;
  }

  const body = {
    title: postData.title,
    content: postData.content,
    postType: postData.postType || 'discussion',
  };

  // 传递自定义作者名（仅管理员账号有效）
  if (AUTHOR_NAME) {
    body.authorName = AUTHOR_NAME;
  }

  if (categoryId) body.categoryId = categoryId;
  if (Array.isArray(postData.tags) && postData.tags.length > 0) {
    body.tags = postData.tags.slice(0, 5);
  }

  log(`发布帖子到 ${SITE_URL}/api/forum/posts...`);

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
    fail(`发帖失败：${res.status} ${text.slice(0, 300)}`);
  }

  const result = await res.json();
  log(`发帖成功！帖子 ID：${result.post?.id || '未知'}`);
  return result;
}

// ===== 主流程 =====
log('=== 自动论坛发帖任务开始 ===');

// 预检 AI API
const healthyModel = await checkAIHealth(TAG);
if (!healthyModel) fail('AI API 预检失败，所有模型均不可用');
log(`使用 AI 模型：${healthyModel}`);

const { topicType, title } = pickTopic();
log(`本次主题类型：${topicType}，标题：${title}`);
if (AUTHOR_NAME) log(`自定义作者名：${AUTHOR_NAME}`);

const token = await login();
const categories = await fetchCategories(token);
const postData = await generatePostContent(title, topicType, categories);
const result = await publishPost(token, postData, categories);

log(`完成！帖子：${postData.title}`);
log(`摘要：${postData.summary || '无'}`);
