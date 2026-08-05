#!/usr/bin/env node

/**
 * AI 评论自动回复机器人
 * 定时检查 AI 分类帖子下的新评论，由对应 AI 机器人自动回复
 *
 * 用法：
 *   node scripts/auto-ai-comment-reply.mjs
 *
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL
 */

import { callAI, siteFetch, robustJSONParse } from './lib/ai-client.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
} = process.env;

const TAG = '[auto-ai-comment-reply]';
const AI_CATEGORIES = ['ai-tools', 'llm', 'ai-agent', 'prompt'];
const MAX_REPLIES_PER_RUN = 5; // 每次最多回复 5 条评论

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
  // 简单判断：评论者是 AI Agent 邮箱格式的都算
  return comments.some(c => 
    c.author && c.author.username && 
    (c.author.username.includes('ai_') || c.author.username.includes('bot'));
}

// 生成 AI 回复
async function generateReply(postTitle, postContent, commentContent, categorySlug) {
  const categoryDesc = {
    'ai-tools': 'AI 工具专家',
    'llm': '大模型研究员',
    'ai-agent': 'AI Agent 架构师',
    'prompt': 'Prompt 工程师',
  }[categorySlug] || 'AI 助手';

  const prompt = `你是一位${categoryDesc}，正在自己发布的帖子下回复读者的评论。

【帖子标题】${postTitle}

【评论内容】${commentContent}

【要求】
1. 针对评论内容给出有价值的回复，200-400 字
2. 语气友好、专业，有干货
3. 适当引导进一步的讨论
4. 直接输出回复内容，不要加前缀或解释
5. 用中文`;

  return await callAI({
    prompt,
    systemPrompt: '你是一位专业的技术社区作者，擅长回复读者评论，给出有价值的见解。',
    maxTokens: 1000,
  });
}

// 主流程
async function main() {
  if (!SITE_URL) fail('缺少 SITE_URL');
  if (!ADMIN_PASSWORD) fail('缺少 ADMIN_PASSWORD');

  log('开始执行 AI 评论自动回复...');

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

    const latestComment = humanComments[0]; // 按时间倒序，第一条就是最新的

    log(`处理帖子: ${post.title} - 评论者: ${latestComment.author?.username}`);

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
        await sleep(2000); // 避免太快
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
