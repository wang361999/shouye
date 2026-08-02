/**
 * 构建后脚本：将 Prisma 的 fast WASM 编译器替换为 small 变体
 *
 * Prisma 7 默认生成 query_compiler_fast_bg.wasm（~3.4 MiB），
 * 超过 Cloudflare Workers 免费版 3 MiB 限制。
 * small 变体（~1.7 MiB）功能相同，仅性能略低，可显著减小 Worker 体积。
 *
 * 同时复制 small 变体的 JavaScript 胶水代码（query_compiler_small_bg.js），
 * 因为 small WASM 的 import 模块名与 fast WASM 不同。
 *
 * 用法: node scripts/swap-prisma-wasm.mjs
 */
import fs from 'fs';
import path from 'path';

const PRISMA_CLIENT_DIR = path.join(
  '.open-next/server-functions/default/node_modules/.prisma/client',
);
const FAST_WASM_PATH = path.join(PRISMA_CLIENT_DIR, 'query_compiler_fast_bg.wasm');
const SMALL_WASM_B64_PATH = path.join(
  'node_modules/@prisma/client/runtime',
  'query_compiler_small_bg.sqlite.wasm-base64.js',
);
const SMALL_JS_SRC_PATH = path.join(
  'node_modules/@prisma/client/runtime',
  'query_compiler_small_bg.sqlite.js',
);
const SMALL_JS_DEST_PATH = path.join(PRISMA_CLIENT_DIR, 'query_compiler_small_bg.js');

function main() {
  // fast WASM 不存在时，尝试从原始 Prisma 客户端目录复制
  if (!fs.existsSync(FAST_WASM_PATH)) {
    console.warn('[swap-prisma-wasm] Fast WASM not found in .open-next, searching in original node_modules...');

    // 查找原始 Prisma 客户端目录中的 WASM 文件
    const originalPaths = [
      path.join(process.cwd(), 'node_modules/.prisma/client/query_compiler_fast_bg.wasm'),
      path.join(process.cwd(), 'node_modules/@prisma/client/runtime/query_compiler_fast_bg.wasm'),
    ];

    let foundFast = null;
    for (const p of originalPaths) {
      if (fs.existsSync(p)) {
        foundFast = p;
        break;
      }
    }

    if (!foundFast) {
      // 如果找不到 fast WASM，直接写入 small WASM 到目标路径
      console.warn('[swap-prisma-wasm] Fast WASM not found anywhere. Writing small WASM directly...');

      if (!fs.existsSync(SMALL_WASM_B64_PATH)) {
        console.error('[swap-prisma-wasm] Small WASM base64 not found:', SMALL_WASM_B64_PATH);
        console.warn('[swap-prisma-wasm] 跳过 WASM 交换。');
        return;
      }

      // 确保目录存在
      fs.mkdirSync(PRISMA_CLIENT_DIR, { recursive: true });

      // 直接写入 small WASM
      const content = fs.readFileSync(SMALL_WASM_B64_PATH, 'utf8');
      const match = content.match(/"([A-Za-z0-9+/=]+)"/);
      if (!match) {
        console.error('[swap-prisma-wasm] Could not extract base64 string from file');
        return;
      }
      const smallWasm = Buffer.from(match[1], 'base64');
      fs.writeFileSync(FAST_WASM_PATH, smallWasm);
      console.log('[swap-prisma-wasm] Wrote small WASM directly: ' + (smallWasm.length / 1024).toFixed(0) + ' KiB');

      // 复制 small JS 胶水代码
      if (fs.existsSync(SMALL_JS_SRC_PATH)) {
        fs.copyFileSync(SMALL_JS_SRC_PATH, SMALL_JS_DEST_PATH);
        console.log('[swap-prisma-wasm] Copied small JS glue code');
      }
      return;
    }

    // 从原始位置复制到 .open-next
    console.log('[swap-prisma-wasm] Found fast WASM at:', foundFast);
    fs.mkdirSync(PRISMA_CLIENT_DIR, { recursive: true });
    fs.copyFileSync(foundFast, FAST_WASM_PATH);
    console.log('[swap-prisma-wasm] Copied fast WASM to .open-next');
  }

  if (!fs.existsSync(SMALL_WASM_B64_PATH)) {
    console.error('[swap-prisma-wasm] Small WASM base64 not found:', SMALL_WASM_B64_PATH);
    console.error('[swap-prisma-wasm] Run "npm install" first to ensure @prisma/client is installed.');
    process.exit(1);
  }

  if (!fs.existsSync(SMALL_JS_SRC_PATH)) {
    console.error('[swap-prisma-wasm] Small JS glue code not found:', SMALL_JS_SRC_PATH);
    process.exit(1);
  }

  const fastSize = fs.statSync(FAST_WASM_PATH).size;

  // 读取 base64 编码的 small WASM
  const content = fs.readFileSync(SMALL_WASM_B64_PATH, 'utf8');
  const match = content.match(/"([A-Za-z0-9+/=]+)"/);
  if (!match) {
    console.error('[swap-prisma-wasm] Could not extract base64 string from file');
    process.exit(1);
  }

  const smallWasm = Buffer.from(match[1], 'base64');
  const smallSize = smallWasm.length;

  // 替换 WASM 二进制
  fs.writeFileSync(FAST_WASM_PATH, smallWasm);

  // 复制 small 变体的 JavaScript 胶水代码
  fs.copyFileSync(SMALL_JS_SRC_PATH, SMALL_JS_DEST_PATH);

  const savings = fastSize - smallSize;
  console.log(
    `[swap-prisma-wasm] Replaced fast WASM (${(fastSize / 1024).toFixed(0)} KiB) ` +
    `with small WASM (${(smallSize / 1024).toFixed(0)} KiB) ` +
    `- saved ${(savings / 1024).toFixed(0)} KiB`,
  );
  console.log('[swap-prisma-wasm] Copied small JS glue code to query_compiler_small_bg.js');
}

main();

