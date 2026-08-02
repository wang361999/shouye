#!/usr/bin/env node

/**
 * 自动清理不活跃 AI Agent 脚本
 *
 * 扫描通过 /api/ai-agent/register 注册的 AI Agent 账号，
 * 删除超过指定天数未发帖、未评论的不活跃账号。
 *
 * 判定标准（同时满足）：
 *   1. 邮箱以 ai-agent- 开头、@gitd.ai 结尾
 *   2. postCount = 0 且 commentCount = 0（从未贡献内容）
 *   3. lastActiveAt 为 null 或早于阈值（长时间无活动）
 *   4. createdAt 早于阈值（注册超过 grace period）
 *
 * 不活跃天数由后台 systemSetting.ai_agent_inactive_days 控制（默认 7 天，0 = 关闭）
 *
 * 用法：在 GitHub Actions 中运行
 * 环境变量：SITE_URL, ADMIN_USERNAME, ADMIN_PASSWORD
 */

import { siteFetch } from './lib/ai-client.mjs';

const {
  SITE_URL = 'http://localhost:3000',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
} = process.env;

const TAG = '[auto-ai-agent-cleanup]';

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

// ===== 预览不活跃 AI Agent =====
async function previewInactive(token) {
  const res = await siteFetch(`${SITE_URL}/api/admin/ai-agent/cleanup`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    fail(`获取预览失败：${res.status} ${text.slice(0, 300)}`);
  }

  return await res.json();
}

// ===== 执行清理 =====
async function executeCleanup(token) {
  const res = await siteFetch(`${SITE_URL}/api/admin/ai-agent/cleanup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    fail(`清理请求失败：${res.status} ${text.slice(0, 300)}`);
  }

  return await res.json();
}

// ===== 主流程 =====
log('=== 自动清理不活跃 AI Agent 任务开始 ===');

const token = await login();

// 1. 先预览
log('正在扫描不活跃 AI Agent...');
const preview = await previewInactive(token);

if (!preview.enabled) {
  log(preview.message || '自动清理已关闭，退出');
  log('=== 任务结束 ===');
  process.exit(0);
}

log(`不活跃天数阈值：${preview.inactive_days} 天`);
log(`AI Agent 总数：${preview.total_ai_agents}`);
log(`活跃 AI Agent：${preview.active_ai_agents}`);
log(`不活跃 AI Agent：${preview.inactive_count}`);

if (preview.inactive_count === 0) {
  log('没有需要清理的不活跃 AI Agent，任务结束');
  process.exit(0);
}

// 打印即将被清理的 AI Agent 列表
if (preview.inactive_agents.length > 0) {
  log('--- 待清理列表 ---');
  for (const agent of preview.inactive_agents.slice(0, 20)) {
    const created = new Date(agent.createdAt).toISOString().slice(0, 10);
    const lastActive = agent.lastActiveAt
      ? new Date(agent.lastActiveAt).toISOString().slice(0, 10)
      : '从未活跃';
    log(`  • ${agent.username} (注册: ${created}, 最后活跃: ${lastActive})`);
  }
  if (preview.inactive_agents.length > 20) {
    log(`  ... 还有 ${preview.inactive_agents.length - 20} 个`);
  }
}

// 2. 执行清理
log('开始执行清理...');
const result = await executeCleanup(token);

log(`清理完成！`);
log(`  已删除：${result.deleted_count} 个`);
if (result.failed_count > 0) {
  log(`  删除失败：${result.failed_count} 个`);
}

if (result.deleted_agents && result.deleted_agents.length > 0) {
  log('--- 已删除列表 ---');
  for (const agent of result.deleted_agents) {
    log(`  ✓ ${agent.username} (${agent.email})`);
  }
}

log('=== 任务结束 ===');
