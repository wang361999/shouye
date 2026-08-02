/**
 * 预构建脚本：修补 @libsql/client 的 package.json 导出条件
 *
 * 问题：
 *   @libsql/client 的 package.json 在 "." 导出中有一个 "workerd" 条件：
 *     "workerd": "./lib-esm/web.js"
 *   但 OpenNext 构建时不会将 lib-esm/ 目录完整复制到 .open-next/ 输出中，
 *   导致 esbuild 解析 @libsql/client 时报错 "Could not resolve @libsql/client"。
 *
 * 修复：
 *   1. 移除 "workerd" 条件
 *   2. 将 "browser" 和 "default" 条件改为指向 "./lib-esm/http.js"
 *      （HTTP-only 客户端，适合 Cloudflare Workers 环境）
 *   3. 这样 esbuild 会解析到 http.js，而 http.js 会被 NFT 追踪到
 *      （因为我们的代码直接从 @libsql/client/http 导入）
 *
 * 用法: node scripts/patch-libsql-exports.mjs
 *
 * 在 cf:build 中运行，位于 opennextjs-cloudflare build 之前
 */
import fs from 'fs';
import path from 'path';

const PACKAGE_JSON_PATH = path.join(
  process.cwd(),
  'node_modules/@libsql/client/package.json',
);

function main() {
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    console.error('[patch-libsql] package.json not found:', PACKAGE_JSON_PATH);
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));

  if (!pkg.exports || !pkg.exports['.']) {
    console.log('[patch-libsql] No exports map found, skipping');
    return;
  }

  const dotExport = pkg.exports['.'];
  if (!dotExport.import) {
    console.log('[patch-libsql] No import condition in exports, skipping');
    return;
  }

  const importConditions = dotExport.import;
  let modified = false;

  // 1. 移除 workerd 条件（指向不存在的 web.js）
  if (importConditions.workerd) {
    delete importConditions.workerd;
    modified = true;
    console.log('[patch-libsql] Removed "workerd" condition (was: ./lib-esm/web.js)');
  }

  // 2. 将 browser 条件改为 http.js（确保使用 HTTP-only 客户端）
  if (importConditions.browser && importConditions.browser !== './lib-esm/http.js') {
    console.log(`[patch-libsql] Changed "browser" condition: ${importConditions.browser} -> ./lib-esm/http.js`);
    importConditions.browser = './lib-esm/http.js';
    modified = true;
  }

  // 3. 将 default 条件改为 http.js
  if (importConditions.default && importConditions.default !== './lib-esm/http.js') {
    console.log(`[patch-libsql] Changed "default" condition: ${importConditions.default} -> ./lib-esm/http.js`);
    importConditions.default = './lib-esm/http.js';
    modified = true;
  }

  // 4. 移除 edge-light 和 netlify 条件（也指向 web.js，可能不存在）
  for (const cond of ['edge-light', 'netlify']) {
    if (importConditions[cond]) {
      console.log(`[patch-libsql] Removed "${cond}" condition (was: ${importConditions[cond]})`);
      delete importConditions[cond];
      modified = true;
    }
  }

  if (modified) {
    // 备份原始文件
    const backupPath = PACKAGE_JSON_PATH + '.bak';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(PACKAGE_JSON_PATH, backupPath);
      console.log('[patch-libsql] Backed up original package.json to', path.basename(backupPath));
    }

    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n');
    console.log('[patch-libsql] Successfully patched @libsql/client/package.json');
    console.log('[patch-libsql] Updated exports["."].import:', JSON.stringify(importConditions, null, 2));
  } else {
    console.log('[patch-libsql] No changes needed, package.json already patched');
  }
}

main();
