#!/usr/bin/env node

/**
 * 临时脚本：更新数据库中的 site_name 和 seo_title
 * 通过站点 API 登录后调用管理接口更新设置
 */

const {
  SITE_URL = 'https://www.gitd.cn',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = '',
} = process.env;

const TAG = '[update-site-name]';

function log(msg) { console.log(`${TAG} ${msg}`); }
function fail(msg) { console.error(`::error::${TAG} ${msg}`); process.exit(1); }

if (!ADMIN_PASSWORD) fail('缺少 ADMIN_PASSWORD');
if (!SITE_URL) fail('缺少 SITE_URL');

async function main() {
  // 1. 登录
  log(`登录 ${SITE_URL}...`);
  const loginRes = await fetch(`${SITE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });

  if (!loginRes.ok) {
    const text = await loginRes.text().catch(() => '');
    fail(`登录失败：${loginRes.status} ${text.slice(0, 300)}`);
  }

  const loginData = await loginRes.json();
  if (!loginData.token) fail('登录返回中没有 token');
  log(`登录成功，用户：${loginData.user?.username}`);

  // 2. 更新设置
  log('更新 site_name 和 seo_title...');
  const updateRes = await fetch(`${SITE_URL}/api/admin/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginData.token}`,
    },
    body: JSON.stringify({
      settings: {
        site_name: 'Gitd',
        seo_title: 'Gitd - 开发者工具集',
      },
    }),
  });

  if (!updateRes.ok) {
    const text = await updateRes.text().catch(() => '');
    fail(`更新设置失败：${updateRes.status} ${text.slice(0, 300)}`);
  }

  const result = await updateRes.json();
  log(`更新成功！site_name: ${result.settings?.site_name || 'Gitd'}`);
  log('完成');
}

main().catch((err) => fail(err?.message || err));
