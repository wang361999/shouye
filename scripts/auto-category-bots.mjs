#!/usr/bin/env node

/**
 * 分类机器人自动发帖脚本
 * 管理三个 AI 机器人，每个负责一个分类（开源分享 / 前端开发 / 后端开发）。
 * 每次运行每个机器人生成并发布一篇帖子，共 3 篇。
 *
 * 用法：
 *   node scripts/auto-category-bots.mjs            # 正式发帖
 *   node scripts/auto-category-bots.mjs --dry-run  # 预览生成内容但不发布
 *
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL
 *   （AI 相关变量由 lib/ai-client.mjs 内部读取）
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
} = process.env;

const TAG = '[auto-category-bots]';
const DRY_RUN = process.argv.includes('--dry-run');

// AI 生成重试次数（与 auto-forum-poster 保持一致）
const AI_GENERATE_RETRIES = 2;

function log(message) { console.log(`${TAG} ${message}`); }
function warn(message) { console.warn(`${TAG} ${message}`); }
function fail(message) { console.error(`::error::${TAG} ${message}`); process.exit(1); }

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 启动校验
if (!DRY_RUN) {
  if (!SITE_URL) fail('缺少 SITE_URL');
  if (!ADMIN_PASSWORD) warn('未配置 ADMIN_PASSWORD，将仅依赖 AI Agent 注册（注册失败则跳过对应机器人）');
}

// ===== 三个分类机器人配置 =====
const BOTS = [
  {
    key: 'open-source',
    authorName: '开源观察者',
    categorySlug: 'open-source',
    tagline: '开源项目推荐、协议分析与社区趋势',
    promptHint: '开源分享：推荐一个开源项目，或分析开源协议、社区趋势，需包含定位、核心亮点、适用场景、协议/治理要点和选型建议',
    discussionQuestion: '你对这个项目/协议/趋势有什么看法或实战经验？欢迎在评论区补充你的体验、替代方案或不同观点。',
    defaultTags: ['开源', '开源项目'],
    persona: { name: 'OSSObserver', owner: 'Gitd Community', desc: '专注开源生态，擅长项目推荐、协议分析与社区趋势' },
    topics: [
      '开源协议选型指南：MIT、Apache 2.0、GPL 该怎么选',
      '开源项目健康度评估：从 Star 数到维护活跃度',
      '2026 年值得关注的 10 个新兴开源项目',
      '如何为开源项目贡献代码：第一次 PR 全流程',
      '开源项目维护者的可持续性困境与解法',
      '开源许可证兼容性：混用组件时要注意什么',
      '从 Fork 到上游合并：开源协作的常见模式',
      '开源社区治理模型对比：BDFL、精英制与基金会',
      '开源项目文档写作的最佳实践',
      '企业使用开源软件的合规清单',
      '开源项目的安全审计：依赖漏洞与 SBOM',
      '开源商业化的几种模式：从 Open Core 到 SaaS',
      '如何评估开源项目是否适合生产环境',
      '开源版本管理：SemVer 之外还有哪些选择',
      '开源贡献者倦怠：社区如何识别与应对',
    ],
  },
  {
    key: 'frontend',
    authorName: '前端探索者',
    categorySlug: 'frontend',
    tagline: 'React/Vue/Next.js、CSS 技巧与性能优化',
    promptHint: '前端开发实战：围绕 React/Vue/Next.js、CSS 技巧或性能优化，写一篇包含原理、代码示例和避坑建议的教程',
    discussionQuestion: '你在实际项目中是怎么处理这个问题的？欢迎分享你的方案、踩坑记录或更好的实践。',
    defaultTags: ['前端', '前端开发'],
    persona: { name: 'FrontendExplorer', owner: 'Gitd Community', desc: '前端开发者，专注 React/Vue 与性能优化' },
    topics: [
      'React 19 新特性实战：Actions 与 useOptimistic',
      'Vue 3 Composition API 进阶：自定义 Hook 设计',
      'Next.js App Router 数据获取模式对比',
      '现代 CSS 容器查询实战：真正的组件级响应式',
      '前端性能优化：Core Web Vitals 达标指南',
      'CSS 逻辑属性与 RTL 国际化布局',
      'React Server Components 落地实践与避坑',
      '前端状态管理选型：Zustand、Jotai 与 Redux Toolkit',
      'View Transitions API：原生页面切换动画',
      '前端构建提速：Vite 与 Turbopack 实测对比',
      '深入理解浏览器渲染：从重排重绘到合成层',
      'CSS Subgrid：解决嵌套网格对齐难题',
      '前端图片优化：AVIF、WebP 与响应式图片',
      '无障碍前端开发：ARIA 与键盘导航实战',
      '前端测试金字塔：Vitest 与 Playwright 分层策略',
    ],
  },
  {
    key: 'backend',
    authorName: '后端架构师',
    categorySlug: 'backend',
    tagline: 'Node.js、数据库设计、API 架构与微服务',
    promptHint: '后端开发实战：围绕 Node.js、数据库设计、API 架构或微服务，写一篇包含原理、代码/配置示例和避坑建议的教程',
    discussionQuestion: '你在后端架构中遇到过类似问题吗？欢迎补充你的方案、性能数据或不同技术选型的对比。',
    defaultTags: ['后端', '后端开发'],
    persona: { name: 'BackendArchitect', owner: 'Gitd Community', desc: '后端架构师，擅长 Node.js、数据库与微服务' },
    topics: [
      'Node.js 事件循环深入理解与性能调优',
      'PostgreSQL 索引设计：从 B-Tree 到 GIN 的选择',
      'RESTful API 设计进阶：版本管理、过滤与分页',
      '微服务拆分边界：领域驱动设计实践',
      '数据库事务隔离级别与并发问题实战',
      'API 限流方案对比：令牌桶、漏桶与滑动窗口',
      'Node.js 流处理：大文件与背压控制',
      '分布式系统的幂等性设计模式',
      '缓存策略选型：Cache-Aside、Read-Through 与 Write-Behind',
      'gRPC vs REST：微服务通信该怎么选',
      '数据库迁移实践：Prisma Migrate 的取舍',
      '后端日志结构化与可观测性建设',
      '消息队列选型：Kafka、RabbitMQ 与 Redis Streams',
      'API 网关的核心职责与落地实践',
      '数据库连接池配置：为什么你的应用总在等连接',
    ],
  },
];

function pickTopic(bot) {
  const pool = bot.topics;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ===== 注册 AI Agent 并获取 token（每个机器人一个独立 Agent）=====
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
      return registerAIAgent(persona);
    }

    warn(`AI Agent 注册失败：${res.status}`);
    return null;
  } catch (error) {
    warn(`AI Agent 注册异常：${error?.message || error}`);
    return null;
  }
}

// ===== 登录（带重试，作为 AI Agent 注册失败时的兜底）=====
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
  return Array.isArray(data.categories) ? data.categories : [];
}

// 按 slug 查找分类 id，找不到时回退到名称匹配
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

// ===== 调用 AI 生成帖子内容（带 JSON 解析重试和兜底提取）=====
async function generatePostContent(bot, title, categories) {
  const categoryNames = categories.map((c) => c.name).join('、') || '综合讨论';
  const professionalRules = buildProfessionalPromptRules({ mode: 'forum' });

  const prompt = `你是一个技术社区的内容创作者，人设是「${bot.authorName}」，专注${bot.tagline}。请生成一篇高质量的论坛帖子。

## 要求

1. 标题：${title}
2. 类型：${bot.promptHint}
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

    // 尝试 JSON 解析
    try {
      const parsed = robustJSONParse(content);
      if (parsed.title && parsed.content) {
        parsed.title = normalizeTitle(parsed.title, title);
        parsed.tags = normalizeTags(parsed.tags, bot.defaultTags);
        parsed.content = appendProfessionalFooter(parsed.content, {
          discussionQuestion: bot.discussionQuestion,
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
        fallback.tags = normalizeTags(fallback.tags, bot.defaultTags);
        fallback.content = appendProfessionalFooter(fallback.content, {
          discussionQuestion: bot.discussionQuestion,
        });
        log(`兜底提取成功，标题：${fallback.title}，内容长度：${fallback.content.length}`);
        return fallback;
      }
    }
  }

  // 抛出异常而不是直接退出，让单个机器人的失败不影响其他机器人
  throw new Error(`AI 生成帖子内容失败（已重试 ${AI_GENERATE_RETRIES + 1} 次）：${lastError?.message || '未知错误'}`);
}

// ===== 发布帖子 =====
async function publishPost(token, bot, postData, categories) {
  // 按分类 slug 找到 categoryId
  const categoryId = findCategoryIdBySlug(categories, bot.categorySlug);
  if (!categoryId) {
    warn(`分类 "${bot.categorySlug}" 未匹配到 categoryId，将不指定分类发布`);
  }

  const body = {
    title: normalizeTitle(postData.title),
    // content 已在生成阶段 appendProfessionalFooter 处理过，这里不再重复追加
    content: postData.content,
    postType: postData.postType || 'discussion',
    isAIGenerated: true,
    authorName: bot.authorName,
  };

  if (categoryId) body.categoryId = categoryId;
  if (Array.isArray(postData.tags) && postData.tags.length > 0) {
    body.tags = normalizeTags(postData.tags);
  }

  log(`发布帖子到 ${SITE_URL}/api/forum/posts...（作者：${bot.authorName}，分类：${bot.categorySlug}）`);

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
    throw new Error(`发帖失败：${res.status} ${text.slice(0, 300)}`);
  }

  const result = await res.json();
  log(`发帖成功！帖子 ID：${result.post?.id || '未知'}`);
  return result;
}

// ===== DRY RUN 预览 =====
function printPreview(bot, postData, categories) {
  const matched = categories.find((c) => c.slug === bot.categorySlug);
  log('=== DRY RUN 预览（不会发布）===');
  log(`机器人：${bot.authorName}`);
  log(`目标分类：${bot.categorySlug}（categoryId: ${matched?.id ?? '未匹配'}）`);
  log(`标题：${postData.title}`);
  log(`标签：${(postData.tags || []).join('、') || '无'}`);
  log(`摘要：${postData.summary || '无'}`);
  log(`内容长度：${postData.content?.length || 0} 字符`);
  log(`内容前 300 字符：\n${postData.content?.slice(0, 300) || ''}`);
  log('=== 预览结束 ===');
}

// 仅打印计划主题（AI 不可用时的 DRY RUN 兜底）
function printPlannedTopics() {
  log('=== 计划主题（DRY RUN，未调用 AI）===');
  for (const bot of BOTS) {
    log(`机器人：${bot.authorName}（分类：${bot.categorySlug}）`);
    log(`  随机主题：${pickTopic(bot)}`);
  }
  log('=== 计划结束 ===');
}

// ===== 单个机器人执行流程 =====
async function runBot(bot, categories, reuseToken) {
  log(`\n--- 机器人：${bot.authorName}（分类 slug：${bot.categorySlug}）---`);

  const title = pickTopic(bot);
  log(`本次主题：${title}`);

  // 生成内容（不需要 token）
  const postData = await generatePostContent(bot, title, categories);

  if (DRY_RUN) {
    printPreview(bot, postData, categories);
    return postData;
  }

  // 获取发布 token：复用已有 token 或注册新 Agent，再回退管理员
  let token = reuseToken;
  if (!token) {
    token = await registerAIAgent(bot.persona);
    if (!token && ADMIN_PASSWORD) {
      log('回退到管理员账号登录...');
      token = await login();
    }
  }
  if (!token) {
    warn(`机器人 ${bot.authorName} 无法获取 token，跳过发布`);
    return null;
  }

  const result = await publishPost(token, bot, postData, categories);
  return result;
}

// ===== 主流程 =====
async function main() {
  log('=== 分类机器人自动发帖任务开始 ===');
  if (DRY_RUN) log('DRY RUN 模式已启用：将生成内容预览但不发布');

  // 预检 AI API
  const healthyModel = await checkAIHealth(TAG);
  if (!healthyModel) {
    if (DRY_RUN) {
      warn('AI API 预检失败，DRY RUN 将仅打印计划的主题');
      printPlannedTopics();
      log('=== 分类机器人自动发帖任务结束 ===');
      return;
    }
    fail('AI API 预检失败，所有模型均不可用');
  }
  log(`使用 AI 模型：${healthyModel}`);

  // 获取分类列表（需要 token）
  // 优先用第一个机器人的 persona 注册 Agent 来获取分类；失败回退管理员
  let categories = [];
  let sharedToken = null;

  if (!DRY_RUN) {
    sharedToken = await registerAIAgent(BOTS[0].persona);
    if (!sharedToken && ADMIN_PASSWORD) {
      log('回退到管理员账号登录获取分类...');
      sharedToken = await login();
    }
    if (!sharedToken) {
      fail('无法获取 token，无法获取分类列表');
    }
    categories = await fetchCategories(sharedToken);
  } else if (ADMIN_PASSWORD) {
    // DRY RUN 下可选地用管理员 token 获取分类，便于预览 categoryId
    try {
      sharedToken = await login();
      categories = await fetchCategories(sharedToken);
    } catch (error) {
      warn(`DRY RUN 获取分类失败：${error?.message || error}，将仅按 slug 预览`);
    }
  }

  log(`共获取到 ${categories.length} 个分类`);

  const results = [];
  for (let i = 0; i < BOTS.length; i++) {
    const bot = BOTS[i];
    // 第一个机器人复用 sharedToken（其 persona 已注册）；其余各自注册
    const reuseToken = i === 0 ? sharedToken : null;
    try {
      const result = await runBot(bot, categories, reuseToken);
      results.push({ bot: bot.authorName, ok: !!result });
    } catch (error) {
      warn(`机器人 ${bot.authorName} 执行失败：${error?.message || error}`);
      results.push({ bot: bot.authorName, ok: false, error: error?.message });
    }
  }

  // 汇总
  log('\n=== 任务汇总 ===');
  for (const r of results) {
    log(`  ${r.bot}: ${r.ok ? '成功' : '失败'}${r.error ? `（${r.error}）` : ''}`);
  }

  const failedCount = results.filter((r) => !r.ok).length;
  if (!DRY_RUN && failedCount === BOTS.length) {
    fail('所有机器人都执行失败');
  }
  log('=== 分类机器人自动发帖任务结束 ===');
}

main().catch((error) => {
  fail(`未捕获的错误：${error?.stack || error}`);
});
