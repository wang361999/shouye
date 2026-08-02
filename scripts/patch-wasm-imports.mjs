/**
 * 修补 WASM 二进制文件：将所有 import 模块名从 ./query_compiler_small_bg.js 改为 ./query_compiler_fast_bg.js
 *
 * WASM 的 import section 中，每个 import 条目都包含模块名。
 * 如果有多个 import 来自同一模块，模块名字符串会出现多次。
 * 此脚本替换所有出现，并修正 section 大小。
 */
import fs from 'fs';
import path from 'path';

const WASM_PATH = path.join(
  '.open-next/server-functions/default/node_modules/.prisma/client',
  'query_compiler_fast_bg.wasm',
);

const OLD_NAME = './query_compiler_small_bg.js';
const NEW_NAME = './query_compiler_fast_bg.js';

function readVarint(bytes, offset) {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (true) {
    const byte = bytes[pos];
    result |= (byte & 0x7F) << shift;
    pos++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, nextOffset: pos };
}

function writeVarint(value) {
  const bytes = [];
  while (true) {
    let byte = value & 0x7F;
    value >>= 7;
    if (value > 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
    if (value === 0) break;
  }
  return Buffer.from(bytes);
}

function findAll(buffer, pattern) {
  const positions = [];
  let idx = 0;
  while (true) {
    const found = buffer.indexOf(pattern, idx);
    if (found === -1) break;
    positions.push(found);
    idx = found + 1;
  }
  return positions;
}

function main() {
  if (!fs.existsSync(WASM_PATH)) {
    console.error('[patch-wasm] WASM file not found:', WASM_PATH);
    process.exit(1);
  }

  const wasm = fs.readFileSync(WASM_PATH);
  console.log(`[patch-wasm] Loaded WASM: ${(wasm.length / 1024).toFixed(0)} KiB`);

  if (wasm[0] !== 0x00 || wasm[1] !== 0x61 || wasm[2] !== 0x73 || wasm[3] !== 0x6D) {
    console.error('[patch-wasm] Invalid WASM magic number');
    process.exit(1);
  }

  const oldNameBytes = Buffer.from(OLD_NAME, 'utf8');
  const newNameBytes = Buffer.from(NEW_NAME, 'utf8');

  const searchPattern = Buffer.concat([writeVarint(oldNameBytes.length), oldNameBytes]);
  const replacement = Buffer.concat([writeVarint(newNameBytes.length), newNameBytes]);

  const sizeDiff = searchPattern.length - replacement.length;

  // Check if already fully patched
  const remainingOld = findAll(wasm, searchPattern);
  if (remainingOld.length === 0) {
    const alreadyNew = findAll(wasm, replacement);
    if (alreadyNew.length > 0) {
      console.log(`[patch-wasm] WASM already patched (${alreadyNew.length} occurrences), skipping`);
      return;
    }
    console.error('[patch-wasm] Could not find any occurrences of the pattern');
    process.exit(1);
  }

  console.log(`[patch-wasm] Found ${remainingOld.length} occurrences to replace`);
  console.log(`[patch-wasm] Pattern: ${searchPattern.length} bytes -> ${replacement.length} bytes (diff: ${sizeDiff} per occurrence)`);

  // Replace all occurrences (process from last to first to preserve offsets)
  let patched = Buffer.from(wasm);
  const positions = [...remainingOld].reverse(); // reverse to not mess up offsets
  for (const pos of positions) {
    patched = Buffer.concat([
      patched.subarray(0, pos),
      replacement,
      patched.subarray(pos + searchPattern.length),
    ]);
  }

  const totalSizeDiff = sizeDiff * remainingOld.length;
  console.log(`[patch-wasm] Total size difference: ${totalSizeDiff} bytes`);

  // Find the section containing the first occurrence and fix its size
  let offset = 8; // skip magic (4) + version (4)
  const firstOccurrence = remainingOld[0];

  while (offset < patched.length) {
    const sectionId = patched[offset];
    const sizeInfo = readVarint(patched, offset + 1);
    const contentStart = sizeInfo.nextOffset;
    const contentEnd = contentStart + sizeInfo.value;

    if (firstOccurrence >= contentStart && firstOccurrence < contentEnd) {
      console.log(`[patch-wasm] Patch is in section ${sectionId} (size: ${sizeInfo.value} bytes)`);

      const newSize = sizeInfo.value - totalSizeDiff;
      const newSizeVarint = writeVarint(newSize);
      const oldSizeVarintLen = sizeInfo.nextOffset - (offset + 1);
      const newSizeVarintLen = newSizeVarint.length;

      const finalWasm = Buffer.concat([
        patched.subarray(0, offset + 1),
        newSizeVarint,
        patched.subarray(contentStart),
      ]);

      console.log(`[patch-wasm] Updated section size: ${sizeInfo.value} -> ${newSize}`);
      if (oldSizeVarintLen !== newSizeVarintLen) {
        console.log(`[patch-wasm] Varint length changed: ${oldSizeVarintLen} -> ${newSizeVarintLen} bytes`);
      }
      console.log(`[patch-wasm] Final WASM size: ${finalWasm.length} bytes (${(finalWasm.length / 1024).toFixed(0)} KiB)`);

      fs.writeFileSync(WASM_PATH, finalWasm);
      console.log('[patch-wasm] Successfully patched WASM file');

      // Verify
      const verify = fs.readFileSync(WASM_PATH);
      const remainingOldAfter = findAll(verify, searchPattern);
      const newFound = findAll(verify, replacement);
      console.log(`[patch-wasm] Verification: ${remainingOldAfter.length} old patterns remaining, ${newFound.length} new patterns found`);

      if (remainingOldAfter.length > 0) {
        console.error('[patch-wasm] WARNING: Some old patterns still remain!');
      }
      return;
    }

    offset = contentEnd;
  }

  console.error('[patch-wasm] Could not find the section containing the patch');
  process.exit(1);
}

main();
