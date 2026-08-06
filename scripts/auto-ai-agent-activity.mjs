#!/usr/bin/env node

/**
 * AI Agent 自动注册 + 活跃脚本（深度优化版）
 *
 * 每次运行：
 * 1. 注册一个新的 AI Agent（随机人设）
 * 2. 用该 Agent 账号发一篇帖子（50%概率）或回复已有帖子（50%概率）
 * 3. 偶尔同时发帖+回复，模拟真实用户行为
 *
 * 优化特性：
 * - 人设差异化：每个人设有不同的说话风格和常用表达
 * - 内容多样化：多种帖子类型（经验分享/提问/讨论/工具推荐/踩坑记录）
 * - 回复风格随机：赞同补充/提问探讨/经验分享/不同角度/感谢提问
 * - 内容去重：避免重复主题
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
  getRandomReplyStyle,
  pickRandom,
  pickDiverseTopic,
  estimateSimilarity,
} from './lib/post-template.mjs';
import { getRandomChallenge, CHALLENGE_IDEAS } from './lib/content-types.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = '',
  ADMIN_PASSWORD = '',
  AUTHOR_NAME = 'GitdBot',
} = process.env;

const TAG = '[ai-agent-activity]';

function log(msg) { console.log(`${TAG} ${msg}`); }
function warn(msg) { console.warn(`${TAG} ${msg}`); }
function fail(msg) { console.error(`::error::${TAG} ${msg}`); process.exit(1); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

if (!SITE_URL) fail('缺少 SITE_URL');

// ===== AI Agent 人设池（带性格特征）=====
const PERSONAS = [
  {
    name: 'CodeNinja',
    owner: 'Gitd Community',
    desc: '热爱全栈开发，专注 React 和 Node.js',
    style: '喜欢用 emoji 表达情绪，说话比较直接，经常分享实战踩坑',
    tags: ['React', 'Node.js', '全栈开发'],
  },
  {
    name: 'DevExplorer',
    owner: 'Gitd Community',
    desc: '探索新技术，分享开发经验和工具',
    style: '语气好奇、充满探索精神，喜欢尝试新东西并分享第一手体验',
    tags: ['新技术', '工具推荐', '开发效率'],
  },
  {
    name: 'ByteWizard',
    owner: 'Gitd Community',
    desc: '后端架构师，擅长分布式系统和数据库优化',
    style: '严谨专业，喜欢从原理出发分析问题，经常给出深度见解',
    tags: ['后端', '分布式', '数据库'],
  },
  {
    name: 'PixelMage',
    owner: 'Gitd Community',
    desc: '前端开发者，热爱 CSS 动画和用户体验设计',
    style: '审美在线，关注细节和体验，喜欢分享 CSS 技巧和动效',
    tags: ['前端', 'CSS', '用户体验'],
  },
  {
    name: 'CloudPilot',
    owner: 'Gitd Community',
    desc: '云原生和 DevOps 实践者',
    style: '务实派，注重自动化和可维护性，分享 DevOps 实战经验',
    tags: ['云原生', 'DevOps', 'Kubernetes'],
  },
  {
    name: 'DataMiner',
    owner: 'Gitd Community',
    desc: '数据工程师，热爱 Python 和机器学习',
    style: '数据驱动，喜欢用数据说话，分享数据分析和 ML 实践',
    tags: ['Python', '数据分析', '机器学习'],
  },
  {
    name: 'StackHunter',
    owner: 'Gitd Community',
    desc: '全栈开发者，喜欢尝试新的技术栈',
    style: '折腾党，什么都想试试，经常分享技术栈对比和迁移经验',
    tags: ['技术栈', '全栈', '折腾'],
  },
  {
    name: 'LogicFox',
    owner: 'Gitd Community',
    desc: '算法竞赛选手，热爱数据结构和算法',
    style: '逻辑清晰，喜欢分析时间复杂度，分享算法题解和优化思路',
    tags: ['算法', '数据结构', 'LeetCode'],
  },
  {
    name: 'WebCraftsman',
    owner: 'Gitd Community',
    desc: 'Web 工匠，追求代码质量和性能',
    style: '工匠精神，注重代码质量和可维护性，分享重构和性能优化',
    tags: ['代码质量', '性能优化', '重构'],
  },
  {
    name: 'TechSage',
    owner: 'Gitd Community',
    desc: '资深开发者，擅长系统设计和架构',
    style: '沉稳老练，喜欢从架构视角看问题，分享系统设计经验',
    tags: ['架构', '系统设计', '技术选型'],
  },
  {
    name: 'NullPointer',
    owner: 'Gitd Community',
    desc: '调试专家，擅长排查疑难 Bug',
    style: '侦探风格，像破案一样排查问题，分享调试技巧和踩坑记录',
    tags: ['调试', 'Bug 排查', '排错'],
  },
  {
    name: 'AsyncMaster',
    owner: 'Gitd Community',
    desc: '异步编程专家，深入理解事件循环',
    style: '擅长解释复杂概念，把异步讲得通俗易懂',
    tags: ['异步编程', 'JavaScript', '事件循环'],
  },
  {
    name: 'ApiKey',
    owner: 'Gitd Community',
    desc: 'API 设计爱好者，REST 和 GraphQL 都玩',
    style: '设计控，关注 API 美学和开发者体验',
    tags: ['API 设计', 'REST', 'GraphQL'],
  },
  {
    name: 'ShellBoss',
    owner: 'Gitd Community',
    desc: '命令行重度用户，写脚本解决问题',
    style: '效率至上，能用一行命令解决的绝不用 GUI',
    tags: ['命令行', 'Shell', '自动化'],
  },
  {
    name: 'RefactorPro',
    owner: 'Gitd Community',
    desc: '代码重构狂人，看到坏味道就想改',
    style: '完美主义，追求代码整洁，分享重构技巧和设计模式',
    tags: ['重构', '设计模式', '代码整洁'],
  },
];

// ===== 帖子主题池（按类型分类）=====
const POST_TOPICS = {
  experience: [
    '你在日常开发中最常用的 Git 技巧是什么？',
    'TypeScript 使用中遇到的坑和解决方案',
    '前端性能优化：你做了哪些有效措施？',
    '从单体到微服务：架构演进的经验教训',
    '数据库索引优化的实战经验分享',
    '代码审查中常见的问题和改进建议',
    '你用过的最好的 CSS 技巧是什么？',
    'RESTful API 设计中容易忽略的细节',
    '单元测试值得吗？我的实践经验',
    'CI/CD 管道优化的几个实用技巧',
    '你如何管理项目中的技术债务？',
    '聊聊函数式编程在前端的实践',
  ],
  question: [
    '你如何看待 Server Components 的未来？',
    '你怎么看待 AI 辅助编程工具？',
    '前端部署策略：CDN、边缘计算还是传统服务器？',
    '你最喜欢的编程语言特性是什么？',
    '微服务真的适合中小团队吗？',
    'TypeScript 是不是被过度使用了？',
    '你觉得低代码平台会取代开发者吗？',
    '远程办公对开发效率有什么影响？',
    '开源项目维护者应该得到报酬吗？',
    '你觉得 WebAssembly 的前景如何？',
  ],
  tool: [
    '分享一个你最近发现的实用开发者工具',
    '推荐一个好用的 VS Code 插件并说明理由',
    '终端效率工具推荐：tmux + zsh 配置分享',
    '这个小众工具帮我解决了大问题',
    '我常用的 5 个提升效率的命令行工具',
  ],
  pitfall: [
    '这个 Bug 我查了三天，最后发现居然是...',
    '线上事故复盘：一个配置项引发的血案',
    '踩坑记录：别再这样用 React useEffect 了',
    '这些常见的数据库坑你踩过几个？',
    '新手最容易犯的 5 个 Node.js 错误',
  ],
  discussion: [
    '聊聊你心目中的"优秀代码"是什么样的',
    '你是如何保持技术学习的热情的？',
    '工作三年和工作一年的区别在哪里？',
    '你心目中理想的技术团队是什么样的？',
    '程序员 35 岁焦虑是真的吗？',
  ],
};

// 获取所有主题列表
const ALL_POST_TOPICS = Object.values(POST_TOPICS).flat();

// ===== 注册 AI Agent =====
async function registerAgent() {
  const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
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

// ===== 随机选择帖子类型 =====
function pickPostType() {
  const types = Object.keys(POST_TOPICS);
  return types[Math.floor(Math.random() * types.length)];
}

// ===== AI 生成帖子内容（多样化版本）=====
async function generatePost(persona, categories) {
  const postType = pickPostType();
  const topics = POST_TOPICS[postType] || ALL_POST_TOPICS;
  const topic = pickRandom(topics);
  const categoryNames = categories.map(c => c.name).join('、') || '综合讨论';

  const typeDesc = {
    experience: '经验分享帖：分享自己的实战经验和做法',
    question: '提问帖：提出一个你好奇的问题，邀请大家讨论',
    tool: '工具推荐帖：推荐一个实用工具并说明为什么好用',
    pitfall: '踩坑记录帖：分享一个你遇到的坑和解决过程',
    discussion: '讨论帖：抛出一个有争议的话题，邀请大家发表看法',
  };

  const prompt = `你是社区用户"${persona.name}"，${persona.desc}。
你的说话风格：${persona.style}

请围绕以下话题写一篇论坛帖子，帖子类型：${typeDesc[postType] || '经验分享'}

## 话题
${topic}

## 要求
1. 用第一人称写，像真实开发者在社区分享经验。
2. 内容用 Markdown 格式，结构自然，不要生硬套模板。
3. 长度 500-1200 字，不要太短也不要太啰嗦。
4. 语言自然、有个人观点，但表达要专业，不要像水帖。
5. 必须体现你的人设特点和说话风格。
6. 开头方式要自然，不要千篇一律地"今天来聊聊"。
7. 不要写"作为 AI""我是 AI"之类表达。
8. 结尾可以提出一个问题或邀请大家讨论。

## 代码块要求

涉及代码、命令、配置的内容，**必须用 Markdown 代码块包裹**并指定语言：
- JS/TS 用 \`\`\`javascript 或 \`\`\`typescript
- Python 用 \`\`\`python
- Shell 命令用 \`\`\`bash
- JSON/YAML 用 \`\`\`json 或 \`\`\`yaml
- HTML/CSS 用 \`\`\`html 或 \`\`\`css

技术类分享至少包含 1 个代码示例或命令示例，代码要完整可运行。

## 输出格式
只输出一个 JSON 对象，不要任何其他文字：
{
  "title": "自然、吸引人的帖子标题（可以与话题不同，用自己的话）",
  "content": "Markdown 格式正文，换行用 \\n",
  "tags": ["标签1", "标签2", "标签3"]
}

论坛分类：${categoryNames}
建议选择一个合适的分类发帖。`;

  const content = await callAI({
    prompt,
    systemPrompt: `你是社区用户${persona.name}，写真实自然的帖子分享。你的风格：${persona.style}。必须只输出一个有效 JSON 对象。`,
    maxTokens: 3000,
    responseFormat: { type: 'json_object' },
    tag: TAG,
  });

  const parsed = robustJSONParse(content);
  if (!parsed.title || !parsed.content) {
    throw new Error('AI 生成的帖子缺少 title 或 content');
  }
  parsed.title = normalizeTitle(parsed.title, topic);
  parsed.tags = normalizeTags(parsed.tags, persona.tags || ['开发经验', '技术讨论']);
  parsed.content = appendProfessionalFooter(parsed.content, {
    discussionQuestion: null, // 让 AI 自己写讨论引导
    includeAiNote: false,
  });
  assertGeneratedPostQuality(parsed, { mode: 'short' });
  log(`帖子类型：${postType}，标题：${parsed.title}`);
  return parsed;
}

// ===== 生成话题挑战帖子（UGC 引导）=====
async function generateChallengePost(persona, categories) {
  const challenge = getRandomChallenge();
  const categoryNames = categories.map(c => c.name).join('、') || '综合讨论';

  const prompt = `你是社区活跃用户"${persona.name}"，${persona.desc}。
你的说话风格：${persona.style}

请发起一个社区话题挑战，引导大家参与讨论。

## 挑战主题
${challenge.title}
${challenge.description}

## 要求
1. 用第一人称写，像真实用户在发起活动一样有感染力。
2. 内容用 Markdown 格式，结构清晰，有明确的参与规则。
3. 长度 400-800 字，简洁有力，不要太长。
4. 要有号召力，能激发大家的参与欲望。
5. 必须体现你的人设特点和说话风格。
6. 不要写"作为 AI""我是 AI"之类表达。
7. 结尾要有明确的行动号召，告诉大家怎么参与。

## 内容结构建议

## 本期挑战
（一句话说明挑战是什么，简洁有吸引力）

## 为什么发起这个挑战
（简单说一下背景，为什么值得参与）

## 参与规则
1. 规则一
2. 规则二
3. 参与方式说明

## 举个例子
（给一个简单的示例，降低参与门槛）

## 怎么参与
（具体步骤：发帖、加标签、评论区回复等）

## 输出格式
只输出一个 JSON 对象，不要任何其他文字：
{
  "title": "吸引人的挑战标题，带【挑战】或【征集】前缀",
  "content": "Markdown 格式正文，换行用 \\\\n",
  "tags": ["挑战", "标签2", "标签3"]
}

论坛分类：${categoryNames}
建议选择一个合适的分类发帖。`;

  const content = await callAI({
    prompt,
    systemPrompt: `你是社区活跃用户${persona.name}，发起有趣的话题挑战引导大家参与。你的风格：${persona.style}。必须只输出一个有效 JSON 对象。`,
    maxTokens: 2000,
    responseFormat: { type: 'json_object' },
    tag: TAG,
  });

  const parsed = robustJSONParse(content);
  if (!parsed.title || !parsed.content) {
    throw new Error('AI 生成的挑战帖缺少 title 或 content');
  }
  parsed.title = normalizeTitle(parsed.title, challenge.title);
  parsed.tags = normalizeTags([...(parsed.tags || []), ...challenge.tags], persona.tags || ['讨论']);
  parsed.content = appendProfessionalFooter(parsed.content, {
    discussionQuestion: '你打算怎么参与这个挑战？来评论区说说你的想法吧！',
    includeAiNote: false,
  });
  log(`挑战帖：${parsed.title}`);
  return parsed;
}

// ===== 发布帖子 =====
async function publishPost(token, postData, categories, persona) {
  let categoryId = null;
  if (categories.length > 0) {
    // 随机选一个非 AI 分类
    const nonAiCats = categories.filter(c => !['ai-tools', 'llm', 'ai-agent', 'prompt'].includes(c.slug));
    const pool = nonAiCats.length > 0 ? nonAiCats : categories;
    categoryId = pool[Math.floor(Math.random() * Math.min(3, pool.length))].id;
  }

  const body = {
    title: normalizeTitle(postData.title),
    content: postData.content,
    postType: 'discussion',
    isAIGenerated: true,
  };
  if (AUTHOR_NAME && !persona) body.authorName = AUTHOR_NAME;
  if (persona) body.authorName = persona.name;
  if (categoryId) body.categoryId = categoryId;
  if (Array.isArray(postData.tags) && postData.tags.length > 0) {
    body.tags = normalizeTags(postData.tags);
  }

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

// ===== AI 生成回复（多样化版本）=====
async function generateReply(persona, post) {
  const replyStyle = getRandomReplyStyle();

  const prompt = `你是社区用户"${persona.name}"，${persona.desc}。
你的说话风格：${persona.style}

你正在浏览论坛，看到这篇帖子，想写一条回复。

## 帖子信息
- 标题：${post.title || '无标题'}
- 作者：${post.author?.username || '楼主'}
- 内容：${(post.content || '').slice(0, 1500)}

## 回复风格
${replyStyle.prompt}

## 回复要求
1. 用第一人称写，像真实用户在回复
2. 80-250 字，简洁有料
3. 必须符合你的人设和说话风格
4. 语言自然，不要像 AI 生成的
5. 直接输出回复正文，不要前缀

请直接输出回复内容（Markdown 格式）：`;

  const reply = await callAI({
    prompt,
    systemPrompt: `你是社区用户${persona.name}，写真实自然的回复。你的风格：${persona.style}。直接输出回复内容。`,
    maxTokens: 800,
    tag: TAG,
  });

  log(`回复风格：${replyStyle.name}`);
  return reply.trim();
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
  log('=== AI Agent 活跃任务开始（深度优化版）===');

  const healthyModel = await checkAIHealth(TAG);
  if (!healthyModel) fail('AI API 预检失败，所有模型均不可用');
  log(`使用 AI 模型：${healthyModel}`);

  let agent = await registerAgent();

  if (!agent) {
    log('AI Agent 注册未成功，回退到管理员账号');
    agent = await adminLogin();
  }

  if (!agent || !agent.token) {
    fail('无法获取有效 token，任务终止');
  }

  log(`使用账号：${agent.username}`);
  if (agent.persona) {
    log(`人设：${agent.persona.name} - ${agent.persona.desc}`);
    log(`风格：${agent.persona.style}`);
  }

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
      log('--- 执行发帖 ---');
      // 20% 概率发起话题挑战帖（UGC 引导）
      const isChallenge = Math.random() < 0.2;
      let postData;
      if (isChallenge) {
        log('本次发布：话题挑战帖');
        postData = await generateChallengePost(
          agent.persona || { name: agent.username, desc: '社区用户', style: '自然分享', tags: ['开发经验', '技术讨论'] },
          categories
        );
      } else {
        postData = await generatePost(
          agent.persona || { name: agent.username, desc: '社区用户', style: '自然分享', tags: ['开发经验', '技术讨论'] },
          categories
        );
      }
      await publishPost(agent.token, postData, categories, agent.persona);
      didPost = true;
    }

    if (action >= 0.5 || action >= 0.8) {
      const targets = posts.filter(p =>
        p.id && p.content && (p.commentCount || 0) === 0 && !p.isLocked
      );

      if (targets.length > 0) {
        const replyCount = Math.min(targets.length, Math.random() > 0.7 ? 2 : 1);
        const selected = targets.sort(() => Math.random() - 0.5).slice(0, replyCount);

        for (const post of selected) {
          try {
            log(`--- 回复帖子：${post.title || post.id} ---`);
            const reply = await generateReply(
              agent.persona || { name: agent.username, desc: '社区用户', style: '自然交流' },
              post
            );
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
