#!/usr/bin/env node

/**
 * 社区周报自动生成脚本
 * 每周自动汇总社区数据（新帖子、新用户、热门工具等），
 * 调用 AI 生成周报文章，发布到论坛
 *
 * 用法：在 GitHub Actions 中运行
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL
 */

import { callAI, checkAIHealth, siteFetch, robustJSONParse } from './lib/ai-client.mjs';
import {
  appendProfessionalFooter,
  normalizeTags,
  normalizeTitle,
} from './lib/post-template.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
  AUTHOR_NAME = 'GitdBot', // AI 发周报时显示的自定义作者名，默认不用 admin
} = process.env;

const TAG = '[auto-weekly-report]';

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
  if (!res.ok) fail(`登录失败：${res.status}`);
  const data = await res.json();
  if (!data.token) fail('登录返回中没有 token');
  return data.token;
}

// ===== 获取社区统计 =====
async function getCommunityStats(token) {
  log('获取社区统计数据...');

  const res = await siteFetch(`${SITE_URL}/api/community/home`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    log('获取社区数据失败，使用空数据继续');
    return { stats: { userCount: 0, postCount: 0, commentCount: 0, todayPostCount: 0 }, hotPosts: [], latestPosts: [] };
  }

  const data = await res.json();
  return data;
}

// ===== 获取论坛帖子列表 =====
async function getRecentPosts(token) {
  log('获取最近帖子...');
  const res = await siteFetch(`${SITE_URL}/api/forum/posts?limit=10&sort=hot`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.posts || [];
}

// ===== 调用 AI 生成周报 =====
async function generateWeeklyReport(stats, hotPosts) {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekEnd = new Date();
  const dateRange = `${weekStart.toISOString().slice(0, 10)} ~ ${weekEnd.toISOString().slice(0, 10)}`;

  const hotPostList = hotPosts.slice(0, 5).map((p, i) =>
    `${i + 1}. **${p.title}** - 👁${p.viewCount || 0} 💬${p.commentCount || 0} ❤️${p.likeCount || 0}`
  ).join('\n') || '本周暂无热门帖子';

  const prompt = `你是一个技术社区的运营编辑。请根据以下数据生成本周的社区周报。

## 时间范围
${dateRange}

## 社区数据
- 注册用户总数：${stats.stats?.userCount || 0}
- 帖子总数：${stats.stats?.postCount || 0}
- 评论总数：${stats.stats?.commentCount || 0}
- 今日新帖：${stats.stats?.todayPostCount || 0}

## 本周热门帖子
${hotPostList}

## 周报要求
1. 标题格式：Gitd 社区周报（${dateRange}）
2. 内容用 Markdown 格式，包含以下板块：
   - 本周摘要（3 条以内，先给重点）
   - 数据概览（用表格展示用户、帖子、评论、今日新增）
   - 热门内容回顾（介绍排名前列的帖子，并说明为什么值得看）
   - 社区观察（从帖子里提炼开发者关心的话题）
   - 下周可以参与什么（给出具体行动建议）
   - 讨论问题（邀请用户补充建议）
3. 语气专业、有亲和力，不要过度营销
4. 长度 800-1800 字
5. 语言：中文
6. 不要编造不存在的数据，只能基于给出的数据表达
7. 不要写“作为 AI”“我是 AI”之类表达

## 输出格式
输出严格 JSON：
{
  "title": "周报标题",
  "content": "Markdown 格式的周报正文",
  "tags": ["周报", "社区动态"],
  "postType": "discussion",
  "summary": "一句话总结本周社区动态"
}`;

  log('调用 AI 生成周报...');

  const content = await callAI({
    prompt,
    systemPrompt: '你是技术社区运营编辑，擅长写有吸引力的社区周报。只输出严格 JSON。',
    maxTokens: 8192,
    responseFormat: { type: 'json_object' },
    tag: TAG,
  });

  let parsed;
  try {
    parsed = robustJSONParse(content);
  } catch (err) {
    fail(`JSON 解析失败：${err.message}`);
  }

  if (!parsed.title || !parsed.content) fail('AI 返回内容缺少 title 或 content');
  parsed.title = normalizeTitle(parsed.title, `Gitd 社区周报（${dateRange}）`);
  parsed.tags = normalizeTags(parsed.tags, ['周报', '社区动态']);
  parsed.content = appendProfessionalFooter(parsed.content, {
    discussionQuestion: '你希望下周周报重点关注哪些技术方向、工具或社区话题？欢迎留言补充。',
  });

  log(`周报生成完成：${parsed.title}`);
  return parsed;
}

// ===== 发布周报到论坛 =====
async function publishReport(token, report) {
  log('发布周报到论坛...');

  const res = await siteFetch(`${SITE_URL}/api/forum/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: normalizeTitle(report.title),
      content: appendProfessionalFooter(report.content, {
        discussionQuestion: '你希望下周周报重点关注哪些技术方向、工具或社区话题？欢迎留言补充。',
      }),
      postType: report.postType || 'discussion',
      tags: normalizeTags(report.tags, ['周报', '社区动态']),
      isAIGenerated: true,
      ...(AUTHOR_NAME && { authorName: AUTHOR_NAME }),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    fail(`发布失败：${res.status} ${text.slice(0, 300)}`);
  }

  const result = await res.json();
  log(`周报发布成功！帖子 ID：${result.id || result.post?.id || '未知'}`);
  return result;
}

// ===== 主流程 =====
log('=== 社区周报自动生成任务开始 ===');
log(`作者名：${AUTHOR_NAME}`);

// 预检 AI API
const healthyModel = await checkAIHealth(TAG);
if (!healthyModel) fail('AI API 预检失败，所有模型均不可用');
log(`使用 AI 模型：${healthyModel}`);

const token = await login();
const stats = await getCommunityStats(token);
const hotPosts = await getRecentPosts(token);
const report = await generateWeeklyReport(stats, hotPosts);
await publishReport(token, report);

log('=== 社区周报自动生成任务完成 ===');
