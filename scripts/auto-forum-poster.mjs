#!/usr/bin/env node

/**
 * 自动论坛发帖脚本
 * 调用 AI 生成开发教程帖子，通过 API 发布到论坛
 *
 * 用法：在 GitHub Actions 中运行
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL
 */

import { callAI, checkAIHealth, siteFetch, robustJSONParse, extractPostFromText } from './lib/ai-client.mjs';
import {
  appendProfessionalFooter,
  buildProfessionalPromptRules,
  normalizeTags,
  normalizeTitle,
} from './lib/post-template.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
  POST_TOPIC = '', // tutorial | random（opensource 已合并到 auto-category-bots 的“开源项目”机器人）
  AUTHOR_NAME = 'GitdBot', // AI 发帖时显示的自定义作者名，默认不用 admin
} = process.env;

const TAG = '[auto-forum-poster]';

// 登录重试配置
const LOGIN_MAX_RETRIES = 2;
const LOGIN_RETRY_DELAY_MS = 3000;
// AI 生成重试次数
const AI_GENERATE_RETRIES = 2;

function log(message) { console.log(`${TAG} ${message}`); }
function warn(message) { console.warn(`${TAG} ${message}`); }
function fail(message) { console.error(`::error::${TAG} ${message}`); process.exit(1); }

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
};

function pickTopic() {
  let topicType = POST_TOPIC;
  if (!topicType || topicType === 'random') {
    topicType = 'tutorial';
  }
  if (topicType === 'opensource') {
    warn('opensource 已合并到“开源项目”分类机器人，auto-forum-poster 将改为生成 tutorial');
    topicType = 'tutorial';
  }
  const pool = TOPICS[topicType] || TOPICS.tutorial;
  const title = pool[Math.floor(Math.random() * pool.length)];
  return { topicType, title };
}

// ===== 注册 AI Agent 并获取 token =====
const AGENT_PERSONAS = [
  { name: 'CodeNinja', owner: 'Gitd Community', desc: '热爱全栈开发，专注 React 和 Node.js' },
  { name: 'DevExplorer', owner: 'Gitd Community', desc: '探索新技术，分享开发经验和工具' },
  { name: 'ByteWizard', owner: 'Gitd Community', desc: '后端架构师，擅长分布式系统' },
  { name: 'PixelMage', owner: 'Gitd Community', desc: '前端开发者，热爱 CSS 动画和 UX 设计' },
  { name: 'CloudPilot', owner: 'Gitd Community', desc: '云原生和 DevOps 实践者' },
  { name: 'DataMiner', owner: 'Gitd Community', desc: '数据工程师，热爱 Python 和 ML' },
  { name: 'TechSage', owner: 'Gitd Community', desc: '资深开发者，擅长系统设计' },
  { name: 'WebCraftsman', owner: 'Gitd Community', desc: 'Web 工匠，追求代码质量和性能' },
  { name: 'NullPointer', owner: 'Gitd Community', desc: '调试专家，擅长排查疑难 Bug' },
  { name: 'RefactorPro', owner: 'Gitd Community', desc: '代码重构狂人，看到坏味道就想改' },
];

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
      // 名字重复，递归重试一次
      log('用户名已存在，重试...');
      return registerAIAgent();
    }

    warn(`AI Agent 注册失败：${res.status}`);
    return null;
  } catch (error) {
    warn(`AI Agent 注册异常：${error?.message || error}`);
    return null;
  }
}

// ===== 登录（带重试）=====
async function login() {
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
        fail(`登录失败：${res.status} ${text.slice(0, 300)}`);
      }

      const data = await res.json();
      if (!data.token) fail('登录返回中没有 token');
      log(`登录成功，用户：${data.user?.username}`);
      return data.token;
    } catch (error) {
      if (error?.name === 'AbortError') {
        warn(`登录超时，${LOGIN_RETRY_DELAY_MS}ms 后重试...`);
      } else {
        warn(`登录异常：${error?.message || error}，${LOGIN_RETRY_DELAY_MS}ms 后重试...`);
      }
      if (attempt < LOGIN_MAX_RETRIES) {
        await sleep(LOGIN_RETRY_DELAY_MS);
        continue;
      }
      fail(`登录失败（已重试 ${LOGIN_MAX_RETRIES + 1} 次）：${error?.message || error}`);
    }
  }
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
  return Array.isArray(data) ? data : (Array.isArray(data.categories) ? data.categories : []);
}

// ===== 调用 AI 生成帖子内容（带 JSON 解析重试和兜底提取）=====
async function generatePostContent(title, topicType, categories) {
  const categoryNames = categories.map((c) => c.name).join('、') || '综合讨论';
  const typeHint = '开发教程：写一篇实用的技术教程，包含背景、步骤、代码示例、避坑建议和讨论引导';
  const professionalRules = buildProfessionalPromptRules({ mode: 'forum' });

  const prompt = `你是一个技术社区的内容创作者。请生成一篇高质量的论坛帖子。

## 要求

1. 标题：${title}
2. 类型：${typeHint}
3. 内容用 Markdown 格式，结构清晰，必要时包含代码块。
4. 内容长度：1200-2400 字。
5. 语言：中文。
6. 要有实际价值，不要空洞的水文。
7. 代码示例要正确可运行；如果涉及命令或配置，要说明使用前提。
8. 帖子要专业、易读，能吸引开发者收藏或参与讨论。
9. 不要写“作为 AI”“我是 AI”之类表达。

${professionalRules}

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
如果分类里有合适的就推荐一个分类名（放在 categoryId 字段，用分类的 id），没有合适的就不填。`;

  log(`调用 AI 生成帖子：${title}`);

  let lastError = null;
  for (let attempt = 0; attempt <= AI_GENERATE_RETRIES; attempt++) {
    const content = await callAI({
      prompt,
      systemPrompt: '你是技术社区内容创作者，擅长写高质量的编程教程和开发实践文章。必须只输出一个有效的 JSON 对象，不要包含任何 markdown 代码块标记或其他文字。',
      maxTokens: 8000,
      responseFormat: { type: 'json_object' },
      tag: TAG,
    });

    // 尝试 JSON 解析
    try {
      const parsed = robustJSONParse(content);
      if (parsed.title && parsed.content) {
        parsed.title = normalizeTitle(parsed.title, title);
        parsed.tags = normalizeTags(parsed.tags, ['教程', '开发实践']);
        parsed.content = appendProfessionalFooter(parsed.content, {
          discussionQuestion: '你在实践这个方案时遇到过哪些坑？欢迎把你的环境、报错和解决方式发出来，后续可以一起整理成更完整的教程。',
        });
        log(`帖子生成完成，标题：${parsed.title}，内容长度：${parsed.content?.length || 0}`);
        return parsed;
      }
      warn(`AI 返回的 JSON 缺少 title 或 content（第 ${attempt + 1} 次）`);
    } catch (parseError) {
      warn(`JSON 解析失败（第 ${attempt + 1} 次）：${parseError.message}`);
      log(`AI 返回内容前300字符：${content.slice(0, 300)}`);
    }

    lastError = new Error('JSON 解析失败');

    // 最后一次尝试时，使用兜底提取
    if (attempt === AI_GENERATE_RETRIES) {
      warn('JSON 解析多次失败，尝试从文本中提取帖子内容...');
      const fallback = extractPostFromText(content, title);
      if (fallback.title && fallback.content && fallback.content.length > 50) {
        fallback.title = normalizeTitle(fallback.title, title);
        fallback.tags = normalizeTags(fallback.tags, ['教程', '开发实践']);
        fallback.content = appendProfessionalFooter(fallback.content);
        log(`兜底提取成功，标题：${fallback.title}，内容长度：${fallback.content.length}`);
        return fallback;
      }
    }
  }

  fail(`AI 生成帖子内容失败（已重试 ${AI_GENERATE_RETRIES + 1} 次）：${lastError?.message || '未知错误'}`);
}

// ===== 发布帖子 =====
async function publishPost(token, postData, categories) {
  let categoryId = null;
  // 验证 AI 返回的 categoryId 是否真实存在（用 String 比较避免类型不匹配）
  if (postData.categoryId) {
    const matched = categories.find((c) => String(c.id) === String(postData.categoryId));
    if (matched) {
      categoryId = matched.id;
    }
  }
  // 没有匹配到分类，用第一个分类
  if (!categoryId && categories.length > 0) {
    categoryId = categories[0].id;
  }

  const body = {
    title: normalizeTitle(postData.title),
    content: appendProfessionalFooter(postData.content),
    postType: postData.postType || 'discussion',
    isAIGenerated: true,
  };

  // 传递自定义作者名（仅管理员账号有效）
  if (AUTHOR_NAME) {
    body.authorName = AUTHOR_NAME;
  }

  if (categoryId) body.categoryId = categoryId;
  if (Array.isArray(postData.tags) && postData.tags.length > 0) {
    body.tags = normalizeTags(postData.tags);
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
async function main() {
  log('=== 自动论坛发帖任务开始 ===');

  // 预检 AI API
  const healthyModel = await checkAIHealth(TAG);
  if (!healthyModel) fail('AI API 预检失败，所有模型均不可用');
  log(`使用 AI 模型：${healthyModel}`);

  const { topicType, title } = pickTopic();
  log(`本次主题类型：${topicType}，标题：${title}`);
  log(`作者名：${AUTHOR_NAME}`);

  // 优先尝试用 AI Agent 账号发帖，注册失败再回退到管理员
  let token = await registerAIAgent();
  if (!token) {
    log('回退到管理员账号登录...');
    token = await login();
  }
  const categories = await fetchCategories(token);
  const postData = await generatePostContent(title, topicType, categories);
  const result = await publishPost(token, postData, categories);

  log(`完成！帖子：${postData.title}`);
  log(`摘要：${postData.summary || '无'}`);
}

main().catch((error) => {
  fail(`未捕获的错误：${error?.stack || error}`);
});
