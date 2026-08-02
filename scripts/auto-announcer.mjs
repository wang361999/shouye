#!/usr/bin/env node

/**
 * 自动公告脚本
 * 定期生成站点公告（新功能上线、社区动态、维护通知等），发布到论坛并置顶
 *
 * 用法：在 GitHub Actions 中运行
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL, AUTHOR_NAME
 */

import { callAI, checkAIHealth, siteFetch } from './lib/ai-client.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
  AUTHOR_NAME = '',
} = process.env;

const TAG = '[auto-announcer]';

function log(message) { console.log(`${TAG} ${message}`); }
function fail(message) { console.error(`::error::${TAG} ${message}`); process.exit(1); }

if (!ADMIN_PASSWORD) fail('缺少 ADMIN_PASSWORD');
if (!SITE_URL) fail('缺少 SITE_URL');

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

// ===== 获取社区统计 =====
async function getCommunityStats(token) {
  const res = await siteFetch(`${SITE_URL}/api/community/home`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return { stats: { userCount: 0, postCount: 0, commentCount: 0, todayPostCount: 0 }, latestPosts: [], hotPosts: [] };
  return await res.json();
}

// ===== 获取最近帖子列表 =====
async function getRecentPosts(token) {
  const res = await siteFetch(`${SITE_URL}/api/forum/posts?limit=10&sort=latest`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.posts || [];
}

// ===== 获取分类列表 =====
async function fetchCategories(token) {
  const res = await siteFetch(`${SITE_URL}/api/forum/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : (data.categories || []);
}

// ===== 检查最近是否已发过公告 =====
async function checkRecentAnnouncement(token) {
  const res = await siteFetch(`${SITE_URL}/api/forum/posts?limit=20&sort=latest`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return false;
  const data = await res.json();
  const posts = data.posts || [];

  // 检查最近 3 天内是否有公告帖
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  return posts.some((p) => {
    const createdAt = new Date(p.createdAt).getTime();
    return createdAt > threeDaysAgo && (p.title?.includes('公告') || p.title?.includes('站点公告') || p.title?.includes('社区公告'));
  });
}

// ===== 调用 AI 生成公告 =====
async function generateAnnouncement(stats, recentPosts, categories) {
  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  const recentPostList = recentPosts.slice(0, 5).map((p, i) =>
    `${i + 1}. **${p.title}** - 👁${p.viewCount || 0} 💬${p.commentCount || 0}`
  ).join('\n') || '暂无最近帖子';

  const categoryNames = categories.map((c) => c.name).join('、') || '综合讨论';

  const prompt = `你是 Gitd 技术社区的运营编辑。请生成本期的站点公告。

## 今天日期
${today}

## 社区数据
- 注册用户总数：${stats.stats?.userCount || 0}
- 帖子总数：${stats.stats?.postCount || 0}
- 评论总数：${stats.stats?.commentCount || 0}
- 今日新帖：${stats.stats?.todayPostCount || 0}

## 最近热门帖子
${recentPostList}

## 论坛分类
${categoryNames}

## 公告要求
1. 标题格式：Gitd 社区公告（${today}）
2. 内容用 Markdown 格式，包含以下板块：
   - 社区近况（用户增长、帖子数据等）
   - 近期精彩内容推荐（推荐最近的好帖子）
   - 新功能与改进（根据社区数据合理推测，如"AI 自动发帖功能已上线"、"社区分类优化"等）
   - 参与号召（鼓励用户发帖、评论、互动）
3. 语气正式但亲切，像一个关心社区的站长
4. 长度 300-800 字
5. 语言：中文

## 输出格式
输出严格 JSON：
{
  "title": "公告标题",
  "content": "Markdown 格式的公告正文",
  "tags": ["公告", "社区动态"],
  "summary": "一句话总结本期公告"
}`;

  log('调用 AI 生成公告...');

  const content = await callAI({
    prompt,
    systemPrompt: '你是技术社区运营编辑，擅长写有吸引力的社区公告。只输出严格 JSON。',
    maxTokens: 4096,
    responseFormat: { type: 'json_object' },
    tag: TAG,
  });

  let parsed;
  try {
    const trimmed = content.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch (err) {
    fail(`JSON 解析失败：${err.message}`);
  }

  if (!parsed.title || !parsed.content) fail('AI 返回内容缺少 title 或 content');
  if (parsed.title.length > 100) parsed.title = parsed.title.slice(0, 97) + '...';

  log(`公告生成完成：${parsed.title}`);
  return parsed;
}

// ===== 发布公告并置顶 =====
async function publishAnnouncement(token, announcement, categories) {
  // 找公告相关分类，没有就用第一个
  let categoryId = null;
  if (categories.length > 0) {
    const announceCat = categories.find((c) =>
      c.slug?.includes('announce') || c.name?.includes('公告') || c.slug?.includes('notice')
    );
    categoryId = (announceCat || categories[0]).id;
  }

  const body = {
    title: announcement.title,
    content: announcement.content,
    postType: 'discussion',
    tags: announcement.tags || ['公告', '社区动态'],
  };

  if (AUTHOR_NAME) body.authorName = AUTHOR_NAME;
  if (categoryId) body.categoryId = categoryId;

  log(`发布公告到 ${SITE_URL}/api/forum/posts...`);

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
    fail(`发布公告失败：${res.status} ${text.slice(0, 300)}`);
  }

  const result = await res.json();
  const postId = result.id || result.post?.id;

  if (!postId) {
    log('警告：无法获取帖子 ID，跳过置顶');
    return result;
  }

  // 置顶公告
  log(`置顶公告帖子 ID：${postId}`);
  try {
    const pinRes = await siteFetch(`${SITE_URL}/api/forum/posts/${postId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'pin' }),
    });

    if (pinRes.ok) {
      log('公告已置顶');
    } else {
      log(`置顶失败：${pinRes.status}`);
    }
  } catch (err) {
    log(`置顶异常：${err.message}`);
  }

  return result;
}

// ===== 主流程 =====
log('=== 自动公告任务开始 ===');
if (AUTHOR_NAME) log(`自定义作者名：${AUTHOR_NAME}`);

// 预检 AI API
const healthyModel = await checkAIHealth(TAG);
if (!healthyModel) fail('AI API 预检失败，所有模型均不可用');
log(`使用 AI 模型：${healthyModel}`);

const token = await login();

// 检查最近是否已发过公告
const hasRecent = await checkRecentAnnouncement(token);
if (hasRecent) {
  log('最近 3 天内已发过公告，跳过');
  process.exit(0);
}

const stats = await getCommunityStats(token);
const recentPosts = await getRecentPosts(token);
const categories = await fetchCategories(token);
const announcement = await generateAnnouncement(stats, recentPosts, categories);
await publishAnnouncement(token, announcement, categories);

log('=== 自动公告任务完成 ===');
