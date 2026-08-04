#!/usr/bin/env node

/**
 * 死链检测脚本
 * 扫描网站所有公开页面和工具链接，检测 404 和超时
 * 发现死链后自动创建 GitHub Issue 通知
 *
 * 用法：在 GitHub Actions 中运行
 * 环境变量：SITE_URL, GITHUB_TOKEN, GITHUB_REPOSITORY
 */

const {
  SITE_URL = '',
  GITHUB_TOKEN = '',
  GITHUB_REPOSITORY = '',
} = process.env;

const TAG = '[auto-link-checker]';
const TIMEOUT_MS = 10_000;
const MAX_CONCURRENT = 5; // 最大并发检测数

function log(...args) { console.log(TAG, ...args); }
function warn(...args) { console.warn(TAG, ...args); }

if (!SITE_URL) { console.error(`${TAG} 缺少 SITE_URL`); process.exit(1); }
if (!GITHUB_TOKEN) { console.error(`${TAG} 缺少 GITHUB_TOKEN`); process.exit(1); }

// ===== 静态页面列表 =====
const STATIC_PATHS = [
  '/',
  '/tools',
  '/forum',
  '/collab',
  '/collab/guide',
  '/collab/new',
  '/docs',
  '/products',
  '/search',
  '/login',
  '/register',
  '/sitemap.xml',
  '/robots.txt',
];

// ===== 工具函数 =====
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return { status: res.status, ok: res.ok, url };
  } catch (err) {
    return { status: 0, ok: false, url, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchJsonWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) return { status: res.status, ok: false, url, data: null };
    return { status: res.status, ok: true, url, data: await res.json() };
  } catch (err) {
    return { status: 0, ok: false, url, data: null, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timeoutId);
  }
}

function escapeTableCell(value) {
  return String(value || '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
    .trim();
}

function formatStatus(link) {
  if (link.error === 'timeout') return '超时';
  if (link.status === 0) return link.error || '请求失败';
  return `HTTP ${link.status}`;
}

function getSuggestion(link) {
  if (link.error === 'timeout') return '检查接口耗时、数据库查询和缓存策略';
  if (link.status === 404) return '检查路由、资源 ID、slug 或数据是否存在';
  if (link.status === 401 || link.status === 403) return '确认该链接是否应公开访问，或调整检测白名单';
  if (link.status >= 500) return '查看服务端日志，优先排查 API 异常和数据库错误';
  if (link.isExternal) return '确认外链是否变更、失效或需要替换';
  return '复现链接并根据状态码定位原因';
}

// ===== 获取动态页面链接 =====
async function getDynamicPaths() {
  const paths = [];

  // 获取工具列表
  try {
    const res = await fetchJsonWithTimeout(`${SITE_URL}/api/tools`);
    if (res.ok) {
      const tools = res.data;
      if (Array.isArray(tools)) {
        for (const tool of tools.slice(0, 50)) {
          paths.push({ path: `/tools/${tool.id}`, label: `工具: ${tool.name}` });
          // 同时检测工具的外链
          if (tool.url && /^https?:\/\//i.test(tool.url)) {
            paths.push({ path: tool.url, label: `工具外链: ${tool.name}`, isExternal: true });
          }
        }
      }
    }
  } catch {
    warn('获取工具列表失败');
  }

  // 获取论坛帖子
  try {
    const res = await fetchJsonWithTimeout(`${SITE_URL}/api/forum/posts?limit=30`);
    if (res.ok) {
      const data = res.data;
      if (data?.posts) {
        for (const post of data.posts) {
          paths.push({ path: `/forum/post/${post.id}`, label: `帖子: ${post.title?.slice(0, 30)}` });
        }
      }
    }
  } catch {
    warn('获取论坛帖子失败');
  }

  // 获取分类
  try {
    const res = await fetchJsonWithTimeout(`${SITE_URL}/api/forum/categories`);
    if (res.ok) {
      const cats = res.data;
      if (Array.isArray(cats)) {
        for (const cat of cats) {
          if (cat.slug) paths.push({ path: `/forum/category/${cat.slug}`, label: `分类: ${cat.name}` });
        }
      }
    }
  } catch {
    warn('获取分类失败');
  }

  // 获取产品
  try {
    const res = await fetchJsonWithTimeout(`${SITE_URL}/api/products`);
    if (res.ok) {
      const products = res.data;
      if (Array.isArray(products)) {
        for (const p of products) {
          if (p.slug) paths.push({ path: `/products/${p.slug}`, label: `产品: ${p.name}` });
        }
      }
    }
  } catch {
    warn('获取产品列表失败');
  }

  return paths;
}

// ===== 批量检测 =====
async function checkLinks(links) {
  const results = [];
  const queue = [...links];

  // 限制并发
  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      const fullUrl = item.isExternal ? item.path : `${SITE_URL}${item.path}`;
      const result = await fetchWithTimeout(fullUrl);
      const status = result.status;
      const isOk = item.isExternal ? status > 0 && status < 400 : result.ok;
      results.push({
        ...item,
        url: fullUrl,
        status,
        ok: isOk,
        error: result.error || null,
      });
      if (!isOk) {
        warn(`死链发现: ${fullUrl} → ${status || result.error}`);
      }
    }
  }

  const workers = Array.from({ length: MAX_CONCURRENT }, () => worker());
  await Promise.all(workers);
  return results;
}

// ===== 创建 GitHub Issue =====
async function createIssue(brokenLinks) {
  if (!GITHUB_REPOSITORY) {
    log('未配置 GITHUB_REPOSITORY，跳过创建 Issue');
    return;
  }

  const [owner, repo] = GITHUB_REPOSITORY.split('/');
  const today = new Date().toISOString().slice(0, 10);
  const grouped = brokenLinks.reduce((acc, link) => {
    const key = link.isExternal ? '外部链接' : '站内页面';
    acc[key] = acc[key] || [];
    acc[key].push(link);
    return acc;
  }, {});
  const priority = brokenLinks.some((link) => !link.isExternal && (link.status === 404 || link.status >= 500))
    ? '高'
    : '中';

  const body = [
    `## 死链检测报告 (${today})`,
    '',
    `本次扫描共发现 **${brokenLinks.length}** 个异常链接，优先级：**${priority}**。`,
    '',
    '### 处理建议',
    '',
    '- 优先修复站内 404 / 5xx，它们会直接影响搜索收录和用户访问。',
    '- 对 401 / 403 先确认是否为预期的登录态限制，避免误修复。',
    '- 对外链异常先确认目标站点是否临时不可用，再决定替换或移除。',
    '',
    ...Object.entries(grouped).flatMap(([groupName, links]) => [
      `### ${groupName}`,
      '',
      '| 页面/链接 | 状态 | 可能原因 | 建议处理 |',
      '|-----------|------|----------|----------|',
      ...links.map((l) => `| [${escapeTableCell(l.label)}](${l.url}) | ${escapeTableCell(formatStatus(l))} | ${escapeTableCell(l.error || '状态码异常')} | ${escapeTableCell(getSuggestion(l))} |`),
      '',
    ]),
    '### 复现方式',
    '',
    `1. 打开对应链接确认是否稳定复现。`,
    `2. 如为站内页面，检查路由、API 返回值和数据库记录是否一致。`,
    `3. 修复后重新运行 auto-link-checker workflow 验证。`,
    '',
    '### 扫描范围',
    '',
    `- 静态页面：${STATIC_PATHS.length} 个`,
    '- 动态页面：工具、论坛帖子、论坛分类、产品详情',
    `- 请求超时阈值：${TIMEOUT_MS / 1000} 秒`,
    '',
    `> 此 Issue 由 [auto-link-checker] 自动创建于 ${new Date().toISOString()}`,
  ].join('\n');

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `死链检测报告 ${today}：发现 ${brokenLinks.length} 个问题`,
      body,
      labels: ['bug', 'auto-link-checker'],
    }),
  });

  if (res.ok) {
    const data = await res.json();
    log(`已创建 Issue #${data.number}`);
  } else {
    warn(`创建 Issue 失败: ${res.status}`);
  }
}

// ===== 主流程 =====
log(`开始扫描 ${SITE_URL} ...`);

// 1. 检测静态页面
log('检测静态页面...');
const staticLinks = STATIC_PATHS.map((p) => ({ path: p, label: `静态: ${p}` }));
const staticResults = await checkLinks(staticLinks);

// 2. 获取并检测动态页面
log('获取动态页面链接...');
const dynamicPaths = await getDynamicPaths();
log(`获取到 ${dynamicPaths.length} 个动态页面`);
const dynamicResults = await checkLinks(dynamicPaths);

// 3. 汇总死链
const allResults = [...staticResults, ...dynamicResults];
const brokenLinks = allResults.filter((r) => !r.ok);

log(`扫描完成：共 ${allResults.length} 个链接，${brokenLinks.length} 个死链`);

// 4. 创建 Issue 通知
if (brokenLinks.length > 0) {
  await createIssue(brokenLinks);
} else {
  log('没有发现死链');
}
