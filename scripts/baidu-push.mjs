#!/usr/bin/env node

/**
 * 百度站长平台 URL 推送脚本
 * 从 sitemap.xml 中提取 URL，通过百度 API 主动推送，加速收录
 *
 * 用法：
 *   node scripts/baidu-push.mjs
 *
 * 环境变量：
 *   BAIDU_SITE_URL   - 站点地址，如 https://www.gitd.cn
 *   BAIDU_PUSH_TOKEN - 百度推送 token
 *   SITEMAP_URL      - sitemap 地址（可选，默认 BAIDU_SITE_URL + /sitemap.xml）
 *   BATCH_SIZE       - 每批推送数量（可选，默认 1000，百度限制单次最多 2000）
 */

const {
  BAIDU_SITE_URL = '',
  BAIDU_PUSH_TOKEN = '',
  SITEMAP_URL = '',
  BATCH_SIZE = '1000',
} = process.env;

const batchSize = parseInt(BATCH_SIZE, 10) || 1000;

function fail(message) {
  console.error(`::error::[baidu-push] ${message}`);
  process.exit(1);
}

async function fetchSitemapUrls(sitemapUrl) {
  console.log(`正在获取 sitemap: ${sitemapUrl}`);
  const res = await fetch(sitemapUrl);
  if (!res.ok) {
    fail(`获取 sitemap 失败: HTTP ${res.status}`);
  }
  const xml = await res.text();

  // 从 <loc> 标签中提取 URL
  const urlRegex = /<loc>([^<]+)<\/loc>/g;
  const urls = [];
  let match;
  while ((match = urlRegex.exec(xml)) !== null) {
    urls.push(match[1].trim());
  }

  console.log(`从 sitemap 中提取到 ${urls.length} 个 URL`);
  return urls;
}

async function pushBatch(urls, siteUrl, token) {
  const apiUrl = `http://data.zz.baidu.com/urls?site=${encodeURIComponent(siteUrl)}&token=${token}`;
  const body = urls.join('\n');

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body,
  });

  const result = await res.json();
  return result;
}

async function main() {
  if (!BAIDU_SITE_URL) fail('缺少环境变量 BAIDU_SITE_URL');
  if (!BAIDU_PUSH_TOKEN) fail('缺少环境变量 BAIDU_PUSH_TOKEN');

  const sitemapUrl = SITEMAP_URL || `${BAIDU_SITE_URL.replace(/\/$/, '')}/sitemap.xml`;

  // 1. 获取所有 URL
  const urls = await fetchSitemapUrls(sitemapUrl);
  if (urls.length === 0) {
    console.log('没有找到 URL，退出');
    return;
  }

  // 2. 分批推送
  const batches = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    batches.push(urls.slice(i, i + batchSize));
  }

  console.log(`分 ${batches.length} 批推送，每批最多 ${batchSize} 条`);

  let totalSuccess = 0;
  let totalRemain = 0;
  let totalNotSame = 0;
  let totalNotValid = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\n[第 ${i + 1}/${batches.length} 批] 推送 ${batch.length} 条...`);

    try {
      const result = await pushBatch(batch, BAIDU_SITE_URL, BAIDU_PUSH_TOKEN);
      console.log(`  成功: ${result.success || 0}`);
      console.log(`  剩余额度: ${result.remain !== undefined ? result.remain : 'N/A'}`);

      totalSuccess += result.success || 0;
      if (result.remain !== undefined) totalRemain = result.remain;
      if (result.not_same_site) totalNotSame += result.not_same_site.length;
      if (result.not_valid) totalNotValid += result.not_valid.length;

      if (result.error) {
        console.error(`  错误: ${result.error} - ${result.message || ''}`);
      }
    } catch (err) {
      console.error(`  推送异常: ${err.message}`);
    }

    // 批次之间稍作延迟，避免请求过快
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log('\n========== 推送完成 ==========');
  console.log(`总 URL 数: ${urls.length}`);
  console.log(`推送成功: ${totalSuccess}`);
  console.log(`剩余额度: ${totalRemain}`);
  if (totalNotSame > 0) console.log(`非本站 URL: ${totalNotSame}`);
  if (totalNotValid > 0) console.log(`不合法 URL: ${totalNotValid}`);
  console.log('===============================');
}

main().catch((err) => {
  fail(`执行异常: ${err.message}`);
});
