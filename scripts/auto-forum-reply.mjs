#!/usr/bin/env node

/**
 * 自动论坛回复脚本
 * 自动登录管理员账号，获取最新论坛帖子，筛选出最近 24 小时内发布且没有评论的帖子，
 * 调用 AI 分析帖子内容并生成有价值的回复，通过 API 发布评论。
 *
 * 用法：在 GitHub Actions 中运行
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL
 */

import { callAI, checkAIHealth, siteFetch } from './lib/ai-client.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
} = process.env;

// 每次最多回复 5 个帖子，避免 API 额度耗尽
const MAX_REPLIES = 5;
// 只回复最近 24 小时内发布的帖子
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
// 每次回复之间的礼貌延迟，避免对 AI API 和站点造成压力
const REPLY_DELAY_MS = 2000;
// 登录最大重试次数
const LOGIN_MAX_RETRIES = 2;
const LOGIN_RETRY_DELAY_MS = 3000;

const TAG = '[auto-forum-reply]';

function log(message) {
  console.log(`${TAG} ${message}`);
}

function warn(message) {
  console.warn(`${TAG} ${message}`);
}

function fail(message) {
  console.error(`::error::${TAG} ${message}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===== 环境变量校验 =====
if (!SITE_URL) fail('缺少 SITE_URL');
if (!ADMIN_USERNAME) fail('缺少 ADMIN_USERNAME');
if (!ADMIN_PASSWORD) fail('缺少 ADMIN_PASSWORD');

// ===== 登录管理员账号（带重试）=====
async function login() {
  for (let attempt = 0; attempt <= LOGIN_MAX_RETRIES; attempt++) {
    try {
      log(`登录 ${SITE_URL} ...（第 ${attempt + 1} 次尝试）`);
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
      log(`登录成功，用户：${data.user?.username}（角色：${data.user?.role || '未知'}）`);
      return data;
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

// ===== 获取最新论坛帖子列表 =====
async function fetchNewestPosts(token) {
  log('获取最新论坛帖子列表 ...');
  const res = await siteFetch(`${SITE_URL}/api/forum/posts?sort=newest&limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    fail(`获取帖子列表失败：${res.status} ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const posts = Array.isArray(data.posts) ? data.posts : [];
  log(`共获取 ${posts.length} 个帖子`);
  return posts;
}

// ===== 筛选需要回复的帖子 =====
// 条件：最近 24 小时内发布、没有评论、未锁定、不是自己发的帖子
function filterPostsToReply(posts, adminUserId) {
  const now = Date.now();
  const cutoff = now - RECENT_WINDOW_MS;

  return posts.filter((post) => {
    // 必须有 id 和正文内容
    if (!post.id || !post.content) return false;

    // 没有评论（commentCount 由后端维护，反映已通过审核的评论数）
    if ((post.commentCount || 0) > 0) return false;

    // 最近 24 小时内发布
    const createdAt = new Date(post.createdAt).getTime();
    if (Number.isNaN(createdAt) || createdAt < cutoff) return false;

    // 跳过被锁定的帖子
    if (post.isLocked) return false;

    // 跳过自己发的帖子，避免回复自动发帖脚本产生的帖子
    if (adminUserId && post.author?.id === adminUserId) return false;

    return true;
  });
}

// ===== 调用 AI 生成回复 =====
async function generateReply(post) {
  const title = post.title || '（无标题）';
  const content = post.content || '';
  const postType = post.postType === 'question' ? 'question' : 'discussion';
  const authorName = post.author?.username || '楼主';
  const categoryName = post.category?.name || '综合讨论';

  const prompt = `你正在浏览一个技术社区论坛，请针对以下帖子写一条有价值的回复。

## 帖子信息
- 标题：${title}
- 作者：${authorName}
- 分类：${categoryName}
- 类型：${postType === 'question' ? '提问' : '讨论 / 分享'}

## 帖子内容
${content}

## 回复要求
1. 语言：中文，使用 Markdown 格式。
2. 态度：友善、专业、有实际帮助。
3. 如果是提问：直接回答问题，给出可操作的方案或代码示例；如果关键信息不足，礼貌地追问必要细节。
4. 如果是分享 / 讨论：给出有意义的反馈，补充观点或延伸思考，避免空洞的"支持一下"。
5. 长度适中（约 100-500 字），不要长篇大论，也不要敷衍。
6. 不要编造不确定的技术细节，不要假装测试过对方的环境。
7. 直接输出回复正文，不要包含"回复："之类的前缀，也不要解释你在做什么。`;

  log(`调用 AI 生成回复，帖子：${title}`);

  const replyContent = await callAI({
    prompt,
    systemPrompt: '你是一个友善的技术社区助手，擅长回答编程问题、参与技术讨论。你的回复专业、真诚、有实际帮助。',
    maxTokens: 2048,
    tag: TAG,
  });

  log(`回复生成完成，长度：${replyContent.length}`);
  return replyContent;
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
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`发布评论失败：${res.status} ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return data;
}

// ===== 处理单个帖子 =====
async function replyToPost(token, post) {
  const title = post.title || post.id;
  log(`--- 处理帖子：${title}（${post.id}）---`);

  const reply = await generateReply(post);
  const result = await postComment(token, post.id, reply);

  // 后端对评论做了敏感词自动审核，命中则进入待审核状态
  if (result?.isApproved === false) {
    warn(`评论已提交但需审核（可能命中敏感词），帖子：${title}`);
  } else {
    log(`回复成功！评论 ID：${result?.id || '未知'}`);
  }
}

// ===== 主流程 =====
async function main() {
  log('=== 自动论坛回复任务开始 ===');

  // 预检 AI API 连通性
  const healthyModel = await checkAIHealth(TAG);
  if (!healthyModel) {
    fail('AI API 预检失败，所有模型均不可用，终止任务');
  }
  log(`使用 AI 模型：${healthyModel}`);

  // 登录
  const { token, user } = await login();
  const adminUserId = user?.id;

  // 获取帖子
  const posts = await fetchNewestPosts(token);
  const targets = filterPostsToReply(posts, adminUserId);

  log(`筛选出 ${targets.length} 个待回复帖子（最近 24 小时内、无评论）`);

  if (targets.length === 0) {
    log('没有需要回复的帖子，任务结束');
    return;
  }

  // 每次最多回复 MAX_REPLIES 个帖子
  const toReply = targets.slice(0, MAX_REPLIES);
  log(`本次将回复最多 ${toReply.length} 个帖子`);

  let successCount = 0;
  let failCount = 0;

  for (const post of toReply) {
    try {
      await replyToPost(token, post);
      successCount++;
    } catch (error) {
      failCount++;
      warn(`回复帖子失败：${post.title || post.id} -> ${error?.message || error}`);
    }

    // 礼貌延迟，避免对 AI API 和站点造成压力
    if (successCount + failCount < toReply.length) {
      await sleep(REPLY_DELAY_MS);
    }
  }

  log('=== 自动论坛回复任务结束 ===');
  log(`成功：${successCount}，失败：${failCount}`);

  // 全部失败时以非零状态退出，便于在 CI 中发现问题
  if (successCount === 0 && failCount > 0) {
    fail('所有回复均失败，请检查 AI API 配置或站点接口');
  }
}

main().catch((error) => {
  fail(`未捕获的错误：${error?.stack || error}`);
});
