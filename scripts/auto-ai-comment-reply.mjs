#!/usr/bin/env node

/**
 * AI 评论自动回复机器人（深度优化版）
 * 定时检查 AI 分类帖子下的新评论，由对应 AI 机器人自动回复
 *
 * 优化特性：
 * - 5 种回复风格随机切换（赞同补充/提问探讨/经验分享/不同角度/感谢提问）
 * - 回复长度随机变化（150-400 字）
 * - 多样化开头和结尾表达
 * - 每个人设有不同的回复语气
 *
 * 用法：
 *   node scripts/auto-ai-comment-reply.mjs
 *
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL
 */

import { callAI, siteFetch, robustJSONParse } from './lib/ai-client.mjs';
import { getRandomReplyStyle, pickRandom } from './lib/post-template.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
} = process.env;

const TAG = '[auto-ai-comment-reply]';
const AI_CATEGORIES = ['ai-tools', 'llm', 'ai-agent', 'prompt'];
const MAX_REPLIES_PER_RUN = 5;

// 各分类对应的人设信息
const CATEGORY_PERSONAS = {
  'ai-tools': {
    name: 'AI工具探索者',
    style: '热情分享，喜欢给具体建议和工具推荐，语气友好积极',
  },
  'llm': {
    name: '大模型研究员',
    style: '严谨专业，喜欢从原理出发分析，经常给出技术深度的见解',
  },
  'ai-agent': {
    name: 'Agent架构师',
    style: '架构思维，喜欢从系统设计角度讨论，给出实践方案',
  },
  'prompt': {
    name: 'Prompt工程师',
    style: '细致实用，喜欢给具体的 Prompt 示例和优化技巧',
  },
};

function log(msg) { console.log(`${TAG} ${msg}`); }
function warn(msg) { console.warn(`${TAG} ${msg}`); }
function fail(msg) { console.error(`::error::${TAG} ${msg}`); process.exit(1); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 登录获取 token
async function login() {
  const res = await siteFetch(`${SITE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error('登录失败');
  const data = await res.json();
  return data.token;
}

// 获取 AI 分类下的最新帖子
async function getAIPosts(token) {
  const posts = [];
  for (const cat of AI_CATEGORIES) {
    try {
      const res = await siteFetch(`${SITE_URL}/api/forum/posts?category=${cat}&limit=10&sort=newest`);
      if (res.ok) {
        const data = await res.json();
        if (data.posts) posts.push(...data.posts);
      }
    } catch (e) {
      warn(`获取 ${cat} 帖子失败: ${e.message}`);
    }
  }
  return posts;
}

// 获取帖子评论
async function getPostComments(token, postId) {
  try {
    const res = await siteFetch(`${SITE_URL}/api/forum/posts/${postId}`);
    if (res.ok) {
      const data = await res.json();
      return data.comments || [];
    }
  } catch (e) {
    warn(`获取评论失败: ${e.message}`);
  }
  return [];
}

// 发布评论
async function postComment(token, postId, content, replyToId = null) {
  const body = { postId, content };
  if (replyToId) body.parentId = replyToId;

  const res = await siteFetch(`${SITE_URL}/api/forum/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`评论失败: ${res.status} ${err}`);
  }
  return res.json();
}

// 判断评论是否已被 AI 回复过
function hasAIReply(comments) {
  return comments.some(c =>
    c.author && c.author.username &&
    (c.author.username.includes('ai_') ||
      c.author.username.includes('bot') ||
      c.author.username.includes('AITools') ||
      c.author.username.includes('LLM') ||
      c.author.username.includes('Agent') ||
      c.author.username.includes('Prompt'))
  );
}

// 生成 AI 回复（多样化版本）
async function generateReply(postTitle, postContent, commentContent, categorySlug) {
  const persona = CATEGORY_PERSONAS[categorySlug] || CATEGORY_PERSONAS['ai-tools'];
  const replyStyle = getRandomReplyStyle();

  // 随机回复长度范围
  const minLen = 150 + Math.floor(Math.random() * 100);
  const maxLen = minLen + 150 + Math.floor(Math.random() * 100);

  const prompt = `你是一位${persona.name}，人设是：${persona.style}
你正在自己发布的帖子下回复读者的评论。

【帖子标题】${postTitle}

【帖子内容摘要】${(postContent || '').slice(0, 800)}

【评论内容】${commentContent}

【回复风格】${replyStyle.prompt}

【要求】
1. 针对评论内容给出有价值的回复，${minLen}-${maxLen} 字
2. 语气要符合你的人设：${persona.style}
3. 适当引导进一步的讨论或抛出一个相关的小问题
4. 直接输出回复内容，不要加前缀或解释
5. 用中文
6. 不要写"作为 AI""我是 AI"之类表达
7. 回复要自然，像真人在论坛回帖一样

请直接输出回复内容：`;

  log(`回复风格：${replyStyle.name}，预计长度：${minLen}-${maxLen}字`);

  return await callAI({
    prompt,
    systemPrompt: `你是${persona.name}，${persona.style}。擅长回复读者评论，给出有价值的见解。直接输出回复内容。`,
    maxTokens: Math.floor(maxLen * 2),
  });
}

// 主流程
async function main() {
  if (!SITE_URL) fail('缺少 SITE_URL');
  if (!ADMIN_PASSWORD) fail('缺少 ADMIN_PASSWORD');

  log('开始执行 AI 评论自动回复（深度优化版）...');

  const token = await login();
  log('登录成功');

  const posts = await getAIPosts(token);
  log(`找到 ${posts.length} 篇 AI 帖子`);

  let repliedCount = 0;

  for (const post of posts) {
    if (repliedCount >= MAX_REPLIES_PER_RUN) break;

    const comments = await getPostComments(token, post.id);
    // 只处理有评论且没有 AI 回复的帖子
    if (comments.length === 0) continue;
    if (hasAIReply(comments)) continue;

    // 找到最新的一条人类评论
    const humanComments = comments.filter(c =>
      c.author && !c.author.username?.includes('ai_') && !c.author.username?.includes('bot')
    );
    if (humanComments.length === 0) continue;

    const latestComment = humanComments[0];

    log(`处理帖子: ${post.title} - 评论者: ${latestComment.author?.username}`);
    log(`评论内容: ${latestComment.content.slice(0, 80)}...`);

    try {
      const reply = await generateReply(
        post.title,
        post.content || '',
        latestComment.content,
        post.category?.slug || 'ai-tools',
      );

      if (reply && reply.trim().length > 20) {
        await postComment(token, post.id, reply.trim(), latestComment.id);
        log(`  ✅ 已回复评论: ${latestComment.author?.username}`);
        repliedCount++;
        await sleep(3000); // 避免太快
      }
    } catch (e) {
      warn(`  回复失败: ${e.message}`);
    }
  }

  log(`执行完成，共回复 ${repliedCount} 条评论`);
}

main().catch(err => {
  fail('执行失败: ' + err.message);
});
