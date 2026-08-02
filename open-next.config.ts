import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// R2 增量缓存未启用（需要先在 Cloudflare 创建 R2 bucket 并配置绑定）
// 如需启用 ISR 缓存，取消下方注释并在 wrangler.jsonc 中配置 r2_buckets
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  // incrementalCache: r2IncrementalCache,
});
