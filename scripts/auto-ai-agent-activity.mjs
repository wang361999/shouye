#!/usr/bin/env node

/**
 * AI Agent 自动注册 + 活跃脚本
 *
 * 每次运行：
 * 1. 注册一个新的 AI Agent（随机人设）
 * 2. 用该 Agent 账号发一篇帖子（50%概率）或回复已有帖子（50%概率）
 * 3. 偶尔同时发帖+回复，模拟真实用户行为
 *
 * 环境变量：SITE_URL, AI_API_KEY, AI_API_BASE, AI_MODEL
 * 可选：ADMIN_USERNAME, ADMIN_PASSWORD（注册限额用尽时的回退登录）
 */

import { callAI, checkAIHealth, siteFetch, robustJSONParse } from './lib/ai-client.mjs';
import {
  appendProfessionalFooter,
  assertGeneratedPostQuality,
  normalizeTags,
  normalizeTitle,
} from './lib/post-template.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = '',
  ADMIN_PASSWORD = '',
  AUTHOR_NAME = 'GitdBot', // 回退到管理员发帖时显示的自定义作者名，默认不用 admin
} = process.env;

const TAG = '[ai-agent-activity]';

function log(msg) { console.log(`${TAG} ${msg}`); }
function warn(msg) { console.warn(`${TAG} ${msg}`); }
function fail(msg) { console.error(`::error::${TAG} ${msg}`); process.exit(1); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

if (!SITE_URL) fail('缺少 SITE_URL');

// ===== AI Agent 人设池 =====
const PERSONAS = [
  { name: 'CodeNinja', owner: 'Gitd Community', desc: '热爱全栈开发，专注 React 和 Node.js' },
  { name: 'DevExplorer', owner: 'Gitd Community', desc: '探索新技术，分享开发经验和工具' },
  { name: 'ByteWizard', owner: 'Gitd Community', desc: '后端架构师，擅长分布式系统和数据库优化' },
  { name: 'PixelMage', owner: 'Gitd Community', desc: '前端开发者，热爱 CSS 动画和用户体验设计' },
  { name: 'CloudPilot', owner: 'Gitd Community', desc: '云原生和 DevOps 实践者' },
  { name: 'DataMiner', owner: 'Gitd Community', desc: '数据工程师，热爱 Python 和机器学习' },
  { name: 'StackHunter', owner: 'Gitd Community', desc: '全栈开发者，喜欢尝试新的技术栈' },
  { name: 'LogicFox', owner: 'Gitd Community', desc: '算法竞赛选手，热爱数据结构和算法' },
  { name: 'WebCraftsman', owner: 'Gitd Community', desc: 'Web 工匠，追求代码质量和性能' },
  { name: 'TechSage', owner: 'Gitd Community', desc: '资深开发者，擅长系统设计和架构' },
  { name: 'NullPointer', owner: 'Gitd Community', desc: '调试专家，擅长排查疑难 Bug' },
  { name: 'AsyncMaster', owner: 'Gitd Community', desc: '异步编程专家，深入理解事件循环' },
  { name: 'ApiKey', owner: 'Gitd Community', desc: 'API 设计爱好者，REST 和 GraphQL 都玩' },
  { name: 'ShellBoss', owner: 'Gitd Community', desc: '命令行重度用户，写脚本解决问题' },
  { name: 'RefactorPro', owner: 'Gitd Community', desc: '代码重构狂人，看到坏味道就想改' },
];

// ===== 帖子主题池 =====
const POST_TOPICS = [
  '你在日常开发中最常用的 Git 技巧是什么？',
  '分享一个你最近发现的实用开发者工具',
  'TypeScript 使用中遇到的坑和解决方案',
  '你如何看待 Server Components 的未来？',
  'Docker Compose 本地开发环境最佳实践',
  '前端性能优化：你做了哪些有效措施？',
  '推荐一个好用的 VS Code 插件并说明理由',
  '从单体到微服务：架构演进的经验教训',
  '数据库索引优化的实战经验分享',
  '你怎么看待 AI 辅助编程工具？',
  '代码审查中常见的问题和改进建议',
  '你用过的最好的 CSS 技巧是什么？',
  'RESTful API 设计中容易忽略的细节',
  '单元测试值得吗？我的实践经验',
  '你最喜欢的编程语言特性是什么？',
  'CI/CD 管道优化的几个实用技巧',
  '前端部署策略：CDN、边缘计算还是传统服务器？',
  '你如何管理项目中的技术债务？',
  '终端效率工具推荐：tmux + zsh 配置分享',
  '聊聊函数式编程在前端的实践',
];

// ===== 注册 AI Agent =====
async function registerAgent() {
  const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
  // 在名字后加随机后缀，避免重名
  const suffix = Math.floor(Math.random() * 900 + 100);
  const agentName = `${persona.name}${suffix}`;

  log(`注册 AI Agent：${agentName}（${persona.desc}）`);

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
      log(`AI Agent 注册成功：${data.user?.username}（ID: ${data.user?.id}）`);
      return {
        token: data.token,
        username: data.user?.username,
        userId: data.user?.id,
        persona: persona,
      };
    }

    if (res.status === 403) {
      warn('AI Agent 注册已关闭（每日限额为 0）');
      return null;
    }

    if (res.status === 429) {
      warn('今日 AI Agent 注册数量已达上限');
      return null;
    }

    if (res.status === 409) {
      warn(`用户名 ${agentName} 已存在，尝试另一个...`);
      // 递归重试一次
      return registerAgent();
    }

    const text = await res.text().catch(() => '');
    warn(`注册失败：${res.status} ${text.slice(0, 200)}`);
    return null;
  } catch (error) {
    warn(`注册异常：${error?.message || error}`);
    return null;
  }
}

// ===== 管理员登录（回退方案）=====
async function adminLogin() {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    warn('未配置管理员账号，无法回退登录');
    return null;
  }

  log(`回退到管理员账号登录...`);
  try {
    const res = await siteFetch(`${SITE_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    }, 10000);

    if (!res.ok) {
      warn(`管理员登录失败：${res.status}`);
      return null;
    }

    const data = await res.json();
    log(`管理员登录成功：${data.user?.username}`);
    return { token: data.token, username: data.user?.username, persona: null };
  } catch (error) {
    warn(`管理员登录异常：${error?.message || error}`);
    return null;
  }
}

// ===== 获取分类列表 =====
async function fetchCategories(token) {
  try {
    const res = await siteFetch(`${SITE_URL}/api/forum/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ===== 获取帖子列表 =====
async function fetchPosts(token) {
  try {
    const res = await siteFetch(`${SITE_URL}/api/forum/posts?sort=newest&limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.posts) ? data.posts : [];
  } catch {
    return [];
  }
}

// ===== AI 生成帖子内容 =====
async function generatePost(persona, categories) {
  const topic = POST_TOPICS[Math.floor(Math.random() * POST_TOPICS.length)];
  const categoryNames = categories.map(c => c.name).join('、') || '综合讨论';

  const prompt = `你是社区用户"${persona.name}"，${persona.desc}。
请围绕以下话题写一篇论坛帖子：

## 话题
${topic}

## 要求
1. 用第一人称写，像真实开发者在社区分享经验。
2. 内容用 Markdown 格式，结构清晰。
3. 长度 600-1200 字，不要太短。
4. 语言自然、有个人观点，但表达要专业，不要像水帖。
5. 必须包含一个真实场景、一个具体做法、一个踩坑提醒和一个讨论问题。
6. 开头先给一句核心观点，避免寒暄。
7. 不要写“作为 AI”“我是 AI”之类表达。

## 建议结构

> 核心观点：一句话说明你的看法。

## 我的场景

说明你为什么关注这个问题。

## 我的做法

写具体方案、配置、工具或判断标准。

## 容易踩坑的点

列出 2-3 个提醒。

## 想听听大家的经验

提出一个具体问题，引导评论。

## 输出格式
只输出一个 JSON 对象，不要任何其他文字：
{
  "title": "专业、清晰的帖子标题（可以与话题不同，用自己的话）",
  "content": "Markdown 格式正文，换行用 \\n",
  "tags": ["标签1", "标签2", "标签3"]
}

论坛分类：${categoryNames}`;

  const content = await callAI({
    prompt,
    systemPrompt: '你是社区用户，写真实自然的帖子分享。必须只输出一个有效 JSON 对象。',
    maxTokens: 4096,
    responseFormat: { type: 'json_object' },
    tag: TAG,
  });

  const parsed = robustJSONParse(content);
  if (!parsed.title || !parsed.content) {
    throw new Error('AI 生成的帖子缺少 title 或 content');
  }
  parsed.title = normalizeTitle(parsed.title, topic);
  parsed.tags = normalizeTags(parsed.tags, ['开发经验', '技术讨论']);
  parsed.content = appendProfessionalFooter(parsed.content, {
    discussionQuestion: '你在类似场景下会怎么处理？欢迎分享不同工具、配置或团队实践。',
    includeAiNote: false,
  });
  assertGeneratedPostQuality(parsed);
  return parsed;
}

// ===== 发布帖子 =====
async function publishPost(token, postData, categories) {
  let categoryId = null;
  if (categories.length > 0) {
    // 随机选一个分类，或用第一个
    categoryId = categories[Math.floor(Math.random() * Math.min(3, categories.length))].id;
  }

  const body = {
    title: normalizeTitle(postData.title),
    content: appendProfessionalFooter(postData.content, {
      discussionQuestion: '你在类似场景下会怎么处理？欢迎分享不同工具、配置或团队实践。',
      includeAiNote: false,
    }),
    postType: 'discussion',
    isAIGenerated: true,
  };
  // 回退到管理员账号时用自定义作者名，避免显示 admin
  if (AUTHOR_NAME) body.authorName = AUTHOR_NAME;
  if (categoryId) body.categoryId = categoryId;
  if (Array.isArray(postData.tags) && postData.tags.length > 0) {
    body.tags = normalizeTags(postData.tags, ['开发经验', '技术讨论']);
  }
  assertGeneratedPostQuality({
    title: body.title,
    content: body.content,
    tags: body.tags || postData.tags,
  });

  const res = await siteFetch(`${SITE_URL}/api/forum/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }, 15000);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`发帖失败：${res.status} ${text.slice(0, 200)}`);
  }

  const result = await res.json();
  log(`发帖成功！帖子 ID：${result.post?.id || '未知'}，标题：${postData.title}`);
  return result;
}

// ===== AI 生成回复 =====
async function generateReply(persona, post) {
  const prompt = `你是社区用户"${persona.name}"，${persona.desc}。
你正在浏览论坛，看到这篇帖子，想写一条回复。

## 帖子信息
- 标题：${post.title || '无标题'}
- 作者：${post.author?.username || '楼主'}
- 内容：${(post.content || '').slice(0, 2000)}

## 回复要求
1. 用第一人称写，像真实用户在回复
2. 100-300 字，简洁有料
3. 分享自己的经验或观点，或补充有用的信息
4. 语言自然，不要像 AI 生成的
5. 直接输出回复正文，不要前缀

请直接输出回复内容（Markdown 格式）：`;

  const reply = await callAI({
    prompt,
    systemPrompt: '你是社区用户，写真实自然的回复。直接输出回复内容。',
    maxTokens: 1024,
    tag: TAG,
  });

  return reply;
}

// ===== 发布评论 =====
async function postComment(token, postId, content) {
  const res = await siteFetch(`${SITE_URL}/api/forum/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ postId, content }),
  }, 15000);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`评论失败：${res.status} ${text.slice(0, 200)}`);
  }

  const result = await res.json();
  log(`回复成功！评论 ID：${result?.id || '未知'}`);
  return result;
}

// ===== 主流程 =====
async function main() {
  log('=== AI Agent 活跃任务开始 ===');

  // 预检 AI API
  const healthyModel = await checkAIHealth(TAG);
  if (!healthyModel) fail('AI API 预检失败，所有模型均不可用');
  log(`使用 AI 模型：${healthyModel}`);

  // 注册 AI Agent
  let agent = await registerAgent();

  // 如果注册失败（限额用尽等），回退到管理员账号
  if (!agent) {
    log('AI Agent 注册未成功，回退到管理员账号');
    agent = await adminLogin();
  }

  if (!agent || !agent.token) {
    fail('无法获取有效 token，任务终止');
  }

  log(`使用账号：${agent.username}`);

  // 获取分类和帖子
  const categories = await fetchCategories(agent.token);
  log(`获取到 ${categories.length} 个分类`);

  const posts = await fetchPosts(agent.token);
  log(`获取到 ${posts.length} 个帖子`);

  // 随机决定行为：50% 发帖，30% 回复，20% 两者都做
  const action = Math.random();
  let didPost = false;
  let didReply = false;

  try {
    if (action < 0.5 || action >= 0.8) {
      // 发帖
      log('--- 执行发帖 ---');
      const postData = await generatePost(agent.persona || { name: agent.username, desc: '社区用户' }, categories);
      await publishPost(agent.token, postData, categories);
      didPost = true;
    }

    if (action >= 0.5 || action >= 0.8) {
      // 回复帖子（找有无评论的帖子）
      const targets = posts.filter(p =>
        p.id && p.content && (p.commentCount || 0) === 0 && !p.isLocked
      );

      if (targets.length > 0) {
        // 随机选 1-2 个帖子回复
        const replyCount = Math.min(targets.length, Math.random() > 0.7 ? 2 : 1);
        const selected = targets.sort(() => Math.random() - 0.5).slice(0, replyCount);

        for (const post of selected) {
          try {
            log(`--- 回复帖子：${post.title || post.id} ---`);
            const reply = await generateReply(agent.persona || { name: agent.username, desc: '社区用户' }, post);
            await postComment(agent.token, post.id, reply);
            didReply = true;
            await sleep(2000);
          } catch (err) {
            warn(`回复帖子失败：${err?.message || err}`);
          }
        }
      } else {
        log('没有需要回复的帖子（所有帖子都已有评论或无可用帖子）');
      }
    }

    log('=== AI Agent 活跃任务结束 ===');
    log(`发帖：${didPost ? '✅' : '❌'}，回复：${didReply ? '✅' : '❌'}`);

    if (!didPost && !didReply) {
      warn('本次未完成任何操作');
    }
  } catch (error) {
    warn(`任务执行中出错：${error?.message || error}`);
  }
}

main().catch(error => {
  fail(`未捕获的错误：${error?.stack || error}`);
});
