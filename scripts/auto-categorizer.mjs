#!/usr/bin/env node

/**
 * 自动分类脚本
 * 扫描没有分类的帖子，调用 AI 根据内容自动分配最合适的分类
 *
 * 用法：在 GitHub Actions 中运行
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL
 */

import { callAI, checkAIHealth, siteFetch, robustJSONParse } from './lib/ai-client.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
} = process.env;

const TAG = '[auto-categorizer]';

function log(message) { console.log(`${TAG} ${message}`); }
function fail(message) { console.error(`::error::${TAG} ${message}`); process.exit(1); }

function normalizeSlug(slug) {
  return String(slug || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .toLowerCase();
}

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

// ===== 获取分类列表 =====
async function fetchCategories(token) {
  const res = await siteFetch(`${SITE_URL}/api/forum/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    log(`获取分类失败：${res.status}`);
    return [];
  }

  const data = await res.json();
  // API 可能返回数组或 { categories: [...] }
  return Array.isArray(data) ? data : (data.categories || []);
}

// ===== 获取未分类帖子 =====
async function fetchUncategorizedPosts(token) {
  // 获取最近 50 条帖子，筛选出没有分类的
  const res = await siteFetch(`${SITE_URL}/api/forum/posts?limit=50&sort=latest&admin=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    log(`获取帖子列表失败：${res.status}`);
    return [];
  }

  const data = await res.json();
  return (data.posts || []).filter((p) => !p.categoryId && p.status === 'PUBLISHED');
}

// ===== 调用 AI 分类帖子 =====
async function categorizePost(post, categories) {
  const categoryList = categories.map((c) => `- ${c.name}（slug: ${c.slug}，描述: ${c.desc || '无'}）`).join('\n');

  const prompt = `你是一个专业的技术社区内容分类编辑。请根据帖子标题和内容，从现有分类中选择最合适的一个，优先保证分类准确性和社区信息架构一致性。

## 帖子信息
标题：${post.title}
内容摘要：${post.content?.slice(0, 500) || '无内容'}

## 可选分类
${categoryList}

## 要求
1. 只能从“可选分类”里选择一个已存在的 slug，不允许编造新分类。
2. 先判断帖子核心意图：教程 / 问题求助 / 工具推荐 / 项目展示 / 社区讨论 / 产品动态。
3. 分类依据优先级：明确技术对象 > 使用场景 > 问题类型 > 帖子语气。
4. 如果没有完全匹配的，选择最接近且不会误导用户的分类。
5. 不要被标题里的泛词误导，例如“分享”“求助”“问题”不能单独决定分类。
6. confidence 用 0-1 小数表示，低于 0.6 时 reason 必须说明为什么仍选择该分类。

## 输出格式
只输出严格 JSON，不要输出其他文字：
{"slug":"分类的slug","confidence":0.86,"reason":"一句话说明分类依据"}`;

  log(`分类帖子：${post.title.slice(0, 40)}`);

  const content = await callAI({
    prompt,
    systemPrompt: '你是专业的技术社区分类编辑。只能选择已给出的分类 slug，并且只输出严格 JSON。',
    maxTokens: 256,
    responseFormat: { type: 'json_object' },
    tag: TAG,
  });

  let parsed;
  try {
    parsed = robustJSONParse(content);
  } catch (err) {
    log(`JSON 解析失败：${err.message}，尝试文本匹配...`);
  }

  // 回退：如果 JSON 解析失败，尝试从文本中匹配分类 slug 或名称
  if (!parsed || !parsed.slug) {
    const lowerContent = content.toLowerCase();
    for (const c of categories) {
      if (lowerContent.includes(c.slug) || lowerContent.includes(c.name.toLowerCase())) {
        log(`文本匹配到分类：${c.name}（slug: ${c.slug}）`);
        return c;
      }
    }
    if (!parsed) {
      log(`无法解析 AI 返回内容：${content.slice(0, 200)}`);
      return null;
    }
  }

  if (!parsed.slug) {
    log('AI 返回内容缺少 slug');
    return null;
  }

  // 验证 slug 是否存在
  const normalizedSlug = normalizeSlug(parsed.slug);
  const matched = categories.find((c) => normalizeSlug(c.slug) === normalizedSlug);
  if (!matched) {
    log(`AI 返回的 slug "${parsed.slug}" 不存在于分类列表中`);
    return null;
  }

  const confidence = Number(parsed.confidence);
  const confidenceText = Number.isFinite(confidence) ? `，置信度：${confidence.toFixed(2)}` : '';
  const reasonText = parsed.reason ? `，依据：${String(parsed.reason).slice(0, 80)}` : '';
  log(`  -> AI 分类判断：${matched.name}${confidenceText}${reasonText}`);

  return matched;
}

// ===== 更新帖子分类 =====
async function updatePostCategory(token, postId, categoryId) {
  const res = await siteFetch(`${SITE_URL}/api/forum/posts/${postId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'setCategory', categoryId }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    log(`更新帖子分类失败：${res.status} ${text.slice(0, 200)}`);
    return false;
  }

  return true;
}

// ===== 主流程 =====
log('=== 自动分类任务开始 ===');

// 预检 AI API
const healthyModel = await checkAIHealth(TAG);
if (!healthyModel) fail('AI API 预检失败，所有模型均不可用');
log(`使用 AI 模型：${healthyModel}`);

const token = await login();
const categories = await fetchCategories(token);

if (categories.length === 0) {
  log('没有可用分类，跳过');
  process.exit(0);
}

log(`共 ${categories.length} 个分类可用`);

const uncategorizedPosts = await fetchUncategorizedPosts(token);
log(`发现 ${uncategorizedPosts.length} 篇未分类帖子`);

if (uncategorizedPosts.length === 0) {
  log('所有帖子都有分类，无需处理');
  process.exit(0);
}

let successCount = 0;
let failCount = 0;

for (const post of uncategorizedPosts) {
  const matched = await categorizePost(post, categories);
  if (matched) {
    log(`  -> 分类为：${matched.name}`);
    const ok = await updatePostCategory(token, post.id, matched.id);
    if (ok) {
      successCount++;
    } else {
      failCount++;
    }
  } else {
    failCount++;
  }

  // 避免 API 限流
  await new Promise((r) => setTimeout(r, 500));
}

log(`=== 分类完成：成功 ${successCount} 篇，失败 ${failCount} 篇 ===`);
