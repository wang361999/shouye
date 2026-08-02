/**
 * 预构建脚本：修补 @libsql 相关包以兼容 Cloudflare Workers (OpenNext)
 *
 * 问题：
 *   1. @libsql/client 的 package.json 有 "workerd": "./lib-esm/web.js" 导出条件
 *      OpenNext 构建时不会将 lib-esm/ 目录复制到 .open-next/ 输出中
 *      → esbuild 报错 "Could not resolve @libsql/client"
 *
 *   2. @libsql/hrana-client 导入 @libsql/isomorphic-ws
 *      OpenNext 不复制 @libsql/isomorphic-ws 到输出目录
 *      → esbuild 报错 "Could not resolve @libsql/isomorphic-ws"
 *
 * 修复：
 *   1. 修补 @libsql/client/package.json：
 *      - 移除 workerd 条件
 *      - 将 browser/default 改为 http.js（HTTP-only 客户端）
 *   2. 修补 @libsql/hrana-client 的 ESM 和 CJS 入口文件：
 *      - 将 @libsql/isomorphic-ws 的 WebSocket 导入替换为全局 WebSocket 引用
 *      - Cloudflare Workers 原生支持 WebSocket，无需 isomorphic-ws 包
 *
 * 用法: node scripts/patch-libsql-exports.mjs
 * 在 cf:build 中运行，位于 opennextjs-cloudflare build 之前
 */
import fs from 'fs';
import path from 'path';

// ============ 1. 修补 @libsql/client/package.json ============
function patchClientPackageJson() {
  const pkgPath = path.join(process.cwd(), 'node_modules/@libsql/client/package.json');

  if (!fs.existsSync(pkgPath)) {
    console.error('[patch-libsql] @libsql/client/package.json not found');
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  if (!pkg.exports?.['.']?.import) {
    console.log('[patch-libsql] No import conditions in @libsql/client, skipping');
    return;
  }

  const importConditions = pkg.exports['.'].import;
  let modified = false;

  // 移除 workerd 条件（指向不存在于 OpenNext 输出中的 web.js）
  if (importConditions.workerd) {
    delete importConditions.workerd;
    modified = true;
    console.log('[patch-libsql] Removed "workerd" condition (was: ./lib-esm/web.js)');
  }

  // 将 browser/default 改为 http.js
  for (const cond of ['browser', 'default']) {
    if (importConditions[cond] && importConditions[cond] !== './lib-esm/http.js') {
      console.log(`[patch-libsql] Changed "${cond}" condition: ${importConditions[cond]} -> ./lib-esm/http.js`);
      importConditions[cond] = './lib-esm/http.js';
      modified = true;
    }
  }

  // 移除 edge-light/netlify 条件（也指向 web.js）
  for (const cond of ['edge-light', 'netlify']) {
    if (importConditions[cond]) {
      delete importConditions[cond];
      modified = true;
      console.log(`[patch-libsql] Removed "${cond}" condition`);
    }
  }

  if (modified) {
    const backupPath = pkgPath + '.bak';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(pkgPath, backupPath);
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('[patch-libsql] Patched @libsql/client/package.json');
  } else {
    console.log('[patch-libsql] @libsql/client/package.json already patched');
  }
}

// ============ 2. 修补 @libsql/hrana-client 移除 isomorphic-ws 依赖 ============
function patchHranaClient() {
  const basePath = path.join(process.cwd(), 'node_modules/@libsql/hrana-client');

  // 修补 ESM 版本 (lib-esm/index.js)
  const esmPath = path.join(basePath, 'lib-esm/index.js');
  if (fs.existsSync(esmPath)) {
    const backupPath = esmPath + '.bak';
    let content = fs.readFileSync(esmPath, 'utf8');

    // 检查是否已修补
    if (!content.includes('@libsql/isomorphic-ws')) {
      console.log('[patch-libsql] @libsql/hrana-client/lib-esm/index.js already patched');
    } else {
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(esmPath, backupPath);
      }

      // 替换 import { WebSocket } from "@libsql/isomorphic-ws"
      content = content.replace(
        /import\s*\{\s*WebSocket\s*\}\s*from\s*"@libsql\/isomorphic-ws";/,
        '// Patched: use global WebSocket instead of @libsql/isomorphic-ws\nconst WebSocket = typeof globalThis.WebSocket !== "undefined" ? globalThis.WebSocket : undefined;',
      );

      // 替换 export { WebSocket } from "@libsql/isomorphic-ws"
      content = content.replace(
        /export\s*\{\s*WebSocket\s*\}\s*from\s*"@libsql\/isomorphic-ws";/,
        '// Patched: WebSocket re-export removed (use global)',
      );

      fs.writeFileSync(esmPath, content);
      console.log('[patch-libsql] Patched @libsql/hrana-client/lib-esm/index.js (removed isomorphic-ws import)');
    }
  }

  // 修补 CJS 版本 (lib-cjs/index.js)
  const cjsPath = path.join(basePath, 'lib-cjs/index.js');
  if (fs.existsSync(cjsPath)) {
    const backupPath = cjsPath + '.bak';
    let content = fs.readFileSync(cjsPath, 'utf8');

    if (!content.includes('@libsql/isomorphic-ws')) {
      console.log('[patch-libsql] @libsql/hrana-client/lib-cjs/index.js already patched');
    } else {
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(cjsPath, backupPath);
      }

      // 替换 require("@libsql/isomorphic-ws") 调用
      // CJS 模式: const isomorphic_ws_1 = require("@libsql/isomorphic-ws");
      // 替换为: const isomorphic_ws_1 = { WebSocket: typeof globalThis.WebSocket !== "undefined" ? globalThis.WebSocket : undefined };
      content = content.replace(
        /require\("@libsql\/isomorphic-ws"\)/g,
        '{ WebSocket: typeof globalThis.WebSocket !== "undefined" ? globalThis.WebSocket : undefined }',
      );

      fs.writeFileSync(cjsPath, content);
      console.log('[patch-libsql] Patched @libsql/hrana-client/lib-cjs/index.js (removed isomorphic-ws require)');
    }
  }
}

// ============ 主函数 ============
function main() {
  console.log('━━━━━━━━━━━━━━ @libsql 补丁 ━━━━━━━━━━━━━━');
  patchClientPackageJson();
  patchHranaClient();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main();
