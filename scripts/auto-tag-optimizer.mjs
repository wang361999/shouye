#!/usr/bin/env node

/**
 * 标签自动优化脚本
 * 定期扫描缺少标签或标签较少的文章，调用 AI 自动生成优化的标签
 * 提升 SEO 效果和内容发现性
 *
 * 用法：在 GitHub Actions 中运行
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD, AI_API_KEY, AI_API_BASE, AI_MODEL
 */

import { callAI, checkAIHealth, siteFetch, robustJSONParse } from './lib/ai-client.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
  BATCH_SIZE = '10', // 每次处理多少篇
  MIN_TAGS = '3', // 少于这个数量标签的文章才处理
  MAX_TAGS = '6', // 生成标签的最大数量
  DRY_RUN = 'false', // 预览模式
} = process.env;

const TAG = '[auto-tag-optimizer]';

function log(message) { console.log(`${TAG} ${message}`); }
function warn(message) { console.warn(`${TAG} ⚠️  ${message}`); }
function fail(message) { console.error(`::error::${TAG} ${message}`); process.exit(1); }

if (!ADMIN_PASSWORD) fail('缺少 ADMIN_PASSWORD');
if (!SITE_URL) fail('缺少 SITE_URL');

const batchSize = parseInt(BATCH_SIZE, 10);
const minTags = parseInt(MIN_TAGS, 10);
const maxTags = parseInt(MAX_TAGS, 10);
const isDryRun = DRY_RUN === 'true';

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

// ===== 获取需要优化标签的文章 =====
async function getPostsForOptimization(token) {
  log(`获取需要优化标签的文章（少于 ${minTags} 个标签）...`);

  // 获取最新文章列表
  const res = await siteFetch(
    `${SITE_URL}/api/forum/posts?limit=${batchSize * 3}&sort=new`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    warn(`获取文章列表失败：${res.status}`);
    return [];
  }

  const data = await res.json();
  const posts = data.posts || [];

  // 筛选标签数量不足的文章
  const candidates = posts.filter((p) => {
    const tagCount = p.tags?.length || 0;
    return tagCount < minTags;
  });

  log(`找到 ${candidates.length} 篇标签不足的文章（共扫描 ${posts.length} 篇）`);
  return candidates.slice(0, batchSize);
}

// ===== AI 生成优化标签 =====
async function generateTagsForPost(post) {
  const content = post.content ? post.content.slice(0, 2000) : '';
  const existingTags = post.tags?.map((t) => t.tag?.name || t.name) || [];

  const prompt = `请为以下技术文章生成 ${maxTags} 个精准的标签。

## 文章标题
${post.title}

## 文章分类
${post.category?.name || '未分类'}

## 文章内容摘要
${content.slice(0, 500)}

## 现有标签
${existingTags.length > 0 ? existingTags.join('、') : '无'}

## 标签要求
1. 生成 ${maxTags} 个标签，其中可以保留优秀的现有标签
2. 标签要精准、专业、符合技术社区规范
3. 标签覆盖维度：技术领域 + 核心技术 + 应用场景 + 难度等级
4. 标签名简洁（2-8 个字），不要太长
5. 优先使用更通用、搜索量更高的标签
6. 不要生成过于宽泛的标签（如"技术""编程"等）
7. 语言：中文

## 输出格式
只输出 JSON：
{
  "tags": ["标签1", "标签2", "标签3"],
  "reason": "一句话说明为什么选这些标签"
}`;

  try {
    const result = await callAI({
      prompt,
      systemPrompt: '你是专业的 SEO 标签优化师，擅长为技术文章生成精准、高搜索价值的标签。只输出严格 JSON。',
      maxTokens: 512,
      temperature: 0.3,
      responseFormat: { type: 'json_object' },
      tag: TAG,
    });

    const parsed = robustJSONParse(result);
    if (!parsed.tags || !Array.isArray(parsed.tags)) {
      warn(`文章 "${post.title}" 标签生成失败：返回格式不正确`);
      return null;
    }

    // 清洗标签
    const cleanTags = parsed.tags
      .filter((t) => typeof t === 'string' && t.length >= 2 && t.length <= 20)
      .slice(0, maxTags);

    if (cleanTags.length === 0) {
      warn(`文章 "${post.title}" 生成的标签全部无效`);
      return null;
    }

    return { tags: cleanTags, reason: parsed.reason || '' };
  } catch (err) {
    warn(`文章 "${post.title}" 标签生成异常：${err.message}`);
    return null;
  }
}

// ===== 更新文章标签 =====
async function updatePostTags(token, postId, tags) {
  if (isDryRun) {
    log(`[预览] 将更新文章 ${postId} 的标签为：${tags.join('、')}`);
    return true;
  }

  try {
    const res = await siteFetch(`${SITE_URL}/api/forum/posts/${postId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tags }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      warn(`更新文章 ${postId} 标签失败：${res.status} ${text.slice(0, 200)}`);
      return false;
    }

    return true;
  } catch (err) {
    warn(`更新文章 ${postId} 标签异常：${err.message}`);
    return false;
  }
}

// ===== 主流程 =====
log('=== 标签自动优化任务开始 ===');
log(`模式：${isDryRun ? '预览（不实际修改）' : '正式运行'}`);
log(`批量大小：${batchSize}，最少标签数：${minTags}，目标标签数：${maxTags}`);

// 预检 AI API
const healthyModel = await checkAIHealth(TAG);
if (!healthyModel) fail('AI API 预检失败，所有模型均不可用');
log(`使用 AI 模型：${healthyModel}`);

const token = await login();
const posts = await getPostsForOptimization(token);

if (posts.length === 0) {
  log('没有需要优化标签的文章，任务结束');
  process.exit(0);
}

let successCount = 0;
let failCount = 0;

for (let i = 0; i < posts.length; i++) {
  const post = posts[i];
  log(`[${i + 1}/${posts.length}] 处理：${post.title.slice(0, 40)}...`);

  const result = await generateTagsForPost(post);
  if (!result) {
    failCount++;
    continue;
  }

  log(`  生成标签：${result.tags.join('、')}`);
  if (result.reason) log(`  优化理由：${result.reason}`);

  const updated = await updatePostTags(token, post.id, result.tags);
  if (updated) {
    successCount++;
    log(`  ✅ 标签已更新`);
  } else {
    failCount++;
  }

  // 避免请求过快
  if (i < posts.length - 1) {
    await new Promise((r) => setTimeout(r, 500));
  }
}

log('=== 标签自动优化任务完成 ===');
log(`成功：${successCount} 篇，失败：${failCount} 篇`);
