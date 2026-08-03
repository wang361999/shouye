/**
 * Gitd 极简兜底 Worker
 *
 * 不依赖数据库、不依赖 Prisma、不依赖 OpenNext。
 * 功能：
 *   /health  → Worker 自身存活检查
 *   /status  → 探测 Vercel 主站是否正常
 *   默认     → 返回维护提示页
 *
 * 部署：wrangler deploy cloudflare/fallback-worker.js --name shouye
 */

// 主站地址（可在 Worker 环境变量中覆盖）
const PRIMARY_SITE = 'https://www.gitd.cn';

// 维护页 HTML
const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gitd - 维护中</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 480px;
    }
    .logo {
      font-size: 2rem;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 1rem;
    }
    .title {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
    }
    .desc {
      font-size: 0.875rem;
      color: #94a3b8;
      line-height: 1.6;
    }
    .status {
      margin-top: 1.5rem;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      background: #1e293b;
      font-size: 0.75rem;
      color: #64748b;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Gitd</div>
    <h1 class="title">网站维护中</h1>
    <p class="desc">主站正在维护或暂时不可用，请稍后访问。<br>我们会尽快恢复服务。</p>
    <div class="status">Powered by Cloudflare Worker</div>
  </div>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // /health → Worker 自身存活检查
    if (path === '/health') {
      return new Response(JSON.stringify({ ok: true, worker: 'shouye-fallback', time: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // /status → 探测主站是否正常
    if (path === '/status') {
      const target = env.PRIMARY_SITE || PRIMARY_SITE;
      try {
        const res = await fetch(target, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(8000),
        });
        return new Response(JSON.stringify({
          ok: res.ok,
          status: res.status,
          target,
          time: new Date().toISOString(),
        }), {
          status: res.ok ? 200 : 503,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({
          ok: false,
          error: err.message || 'fetch failed',
          target,
          time: new Date().toISOString(),
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 默认 → 维护页
    return new Response(MAINTENANCE_HTML, {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Retry-After': '300',
        'Cache-Control': 'no-store',
      },
    });
  },
};
