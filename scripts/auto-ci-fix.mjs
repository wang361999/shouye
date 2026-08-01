#!/usr/bin/env node

/**
 * CI 失败自动修复脚本
 *
 * 在 PR 触发的 CI 中，若 lint 或 build 失败，读取错误日志，
 * 调用 AI 分析错误并生成修复代码（分隔符格式），自动 commit 并 push 到 PR 分支。
 * 内置最多 N 次重试（默认 2 次），每次重试会重新运行 lint/build 验证修复效果。
 *
 * 用法：在 GitHub Actions 中运行（见 .github/workflows/auto-ci-fix.yml）
 * 环境变量：
 *   AI_API_KEY      AI 接口密钥（必填）
 *   AI_API_BASE     AI 接口地址（默认 Gemini OpenAI 兼容端点）
 *   AI_MODEL        模型名（默认 gemini-3.6-flash）
 *   GH_TOKEN        GitHub Token（用于 gh 命令，必填）
 *   GITHUB_TOKEN    GitHub Token（备用，用于 git push）
 *   PR_NUMBER       PR 编号（必填，用于发布评论）
 *   MAX_RETRIES     最大修复重试次数（默认 2）
 *   LINT_FAILED     初始 lint 是否失败（'true'/'false'，默认 'false'）
 *   BUILD_FAILED    初始 build 是否失败（'true'/'false'，默认 'false'）
 *   LINT_LOG_PATH   lint 日志文件路径（默认 ci-lint.log）
 *   BUILD_LOG_PATH  build 日志文件路径（默认 ci-build.log）
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const {
  AI_API_KEY = '',
  AI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  AI_MODEL = 'gemini-3.6-flash',
  GH_TOKEN = '',
  GITHUB_TOKEN = '',
  GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || '',
  PR_NUMBER = '',
  MAX_RETRIES = '2',
  LINT_FAILED = 'false',
  BUILD_FAILED = 'false',
  LINT_LOG_PATH = 'ci-lint.log',
  BUILD_LOG_PATH = 'ci-build.log',
} = process.env;

const TAG = '[auto-ci-fix]';
const MAX_LOG_CHARS = 20_000; // 传给 AI 的单条日志最大字符数
const MAX_CONTEXT_CHARS = 80_000; // 上下文文件总字符数
const MAX_FILE_CHARS = 15_000; // 单个上下文文件最大字符数
const MAX_CONTEXT_FILES = 20; // 最多收集的上下文文件数

function log(...args) {
  console.log(TAG, ...args);
}
function warn(...args) {
  console.warn(TAG, ...args);
}
function fail(message) {
  console.error(`${TAG} ${message}`);
  process.exit(1);
}

// ===== 环境校验 =====
if (!AI_API_KEY) {
  fail('缺少 AI_API_KEY。请在仓库 Settings → Secrets → Actions 中配置 AI_API_KEY（免费获取：https://aistudio.google.com/apikey）');
}
const token = GH_TOKEN || GITHUB_TOKEN;
if (!token) fail('缺少 GH_TOKEN / GITHUB_TOKEN。');
if (!PR_NUMBER) fail('缺少 PR_NUMBER。');

const maxAttempts = Math.max(1, parseInt(MAX_RETRIES, 10) || 2);

// ===== Shell 工具函数 =====
function runShell(command, { env } = {}) {
  try {
    const stdout = execFileSync('bash', ['-c', command], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      maxBuffer: 20 * 1024 * 1024,
    });
    return { ok: true, output: stdout };
  } catch (err) {
    const output = `${err.stdout || ''}${err.stderr || ''}`;
    return { ok: false, output };
  }
}

// 运行 lint/build 检查，捕获合并输出并写入日志文件
function runCheck(command, logPath) {
  const result = runShell(`${command} 2>&1`);
  const output = (result.output || '').trim() || '(无输出)';
  if (logPath) {
    try {
      writeFileSync(logPath, output, 'utf8');
    } catch (e) {
      warn(`写入日志文件失败 ${logPath}: ${e.message}`);
    }
  }
  return { ok: result.ok, log: output };
}

// ===== 路径安全校验（与 free-ai-issue-executor.mjs 保持一致） =====
function isTextFile(file) {
  const allowedExts = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md',
    '.yml', '.yaml', '.css', '.scss', '.html', '.prisma',
  ];
  return allowedExts.some((ext) => file.endsWith(ext));
}

function isSafePath(filePath) {
  const normalized = path.posix.normalize(filePath);
  if (normalized.startsWith('../') || normalized.startsWith('/')) return false;
  if (normalized.includes('/.git/')) return false;
  if (normalized === '.env' || normalized === '.env.local') return false;
  if (normalized.includes('node_modules/') || normalized.includes('.next/')) return false;
  if (normalized.includes('prisma/migrations/')) return false;
  return isTextFile(normalized);
}

// 截断文本：保留头部和尾部（错误通常在末尾）
function truncate(text, max) {
  if (!text) return '';
  if (text.length <= max) return text;
  const headLen = Math.floor(max * 0.2);
  const tailLen = max - headLen;
  return `${text.slice(0, headLen)}\n...（已截断 ${text.length - max} 字符）...\n${text.slice(-tailLen)}`;
}

// ===== 上下文收集：从错误日志中提取相关文件并读取内容 =====
function extractFilePaths(log) {
  const paths = new Set();
  const regex = /([A-Za-z0-9_@./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|css|scss|json|md|prisma|yml|yaml))/g;
  let m;
  while ((m = regex.exec(log)) !== null) {
    const p = m[1].replace(/^\.\//, '');
    paths.add(p);
  }
  return Array.from(paths);
}

function collectContext(lintLog, buildLog) {
  const logs = `${lintLog}\n${buildLog}`;
  const candidates = extractFilePaths(logs).filter(isSafePath);

  const files = [];
  let totalLen = 0;
  for (const file of candidates) {
    if (files.length >= MAX_CONTEXT_FILES) break;
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    content = content.slice(0, MAX_FILE_CHARS);
    const block = `\n\n--- FILE: ${file} ---\n${content}`;
    if (totalLen + block.length > MAX_CONTEXT_CHARS) break;
    files.push({ file, block });
    totalLen += block.length;
  }

  // 项目文件树（前 200 个），帮助 AI 理解项目结构
  let tree = '';
  try {
    tree = runShell('git ls-files')
      .output.split('\n')
      .filter(Boolean)
      .slice(0, 200)
      .join('\n');
  } catch {
    /* ignore */
  }

  return { tree, files, fileCount: files.length };
}

// ===== 分隔符格式解析（与 free-ai-issue-executor.mjs 一致） =====
function parseDelimiterFormat(text) {
  const summaryMatch = text.match(
    /===SUMMARY===\s*([\s\S]*?)(?=\n===FILE:|\n===END===|\n===DETAILS===|$)/i,
  );
  const summary = summaryMatch ? summaryMatch[1].trim() : '';

  const fileRegex = /===FILE:\s*(.+?)\s*===\s*([\s\S]*?)(?=\n===FILE:|\n===END===|$)/g;
  const changes = [];
  let match;
  while ((match = fileRegex.exec(text)) !== null) {
    changes.push({ path: match[1].trim(), content: match[2] });
  }
  return { summary, changes };
}

// ===== AI 调用 =====
async function callAi({ lintFailed, buildFailed, lintLog, buildLog, context, attempt }) {
  const failedParts = [];
  if (lintFailed) failedParts.push('lint');
  if (buildFailed) failedParts.push('build');

  const prompt = `你是一名资深全栈工程师，正在维护这个 Next.js 开源项目。CI 检查中的 ${failedParts.join(' 和 ')} 失败了，请分析错误日志，定位根因并生成修复代码。

## 失败的检查项
${failedParts.map((f) => `- ${f}`).join('\n')}

## lint 错误日志
${lintFailed ? truncate(lintLog, MAX_LOG_CHARS) : '（lint 通过，无需处理）'}

## build 错误日志
${buildFailed ? truncate(buildLog, MAX_LOG_CHARS) : '（build 通过，无需处理）'}

## 项目文件树
${context.tree}

## 相关代码文件
${context.files.map((f) => f.block).join('\n') || '（未能自动定位相关文件，请根据错误日志中的路径推断并修复）'}

## 工作原则
1. 仔细阅读错误日志，找到具体的报错位置和原因，不要敷衍回复"没问题"。
2. 只修改必要的文件来修复错误，不要做无关改动。
3. 确保修复后 npm run lint 和 npm run build 都能通过。
4. 不要修改 node_modules、.next、.env、.env.local、prisma/migrations。
5. 不要修改 prisma/schema.prisma 的已有字段（可新增字段，不可删除或修改已有字段）。
6. 不要引入重量级新依赖。
7. 禁止泄露或改写密钥、Token、密码。

## 输出格式（必须严格遵守，不要用 JSON，不要用 Markdown 代码块包裹文件内容）
===SUMMARY===
一句话说明本次修复内容
===FILE: 相对仓库根目录的文件路径===
该文件修改后的完整内容
===FILE: 另一个文件路径===
该文件修改后的完整内容
===END===

注意：
- 每个 ===FILE: 后跟文件路径，下一行开始就是文件完整内容，直到下一个 ===FILE: 或 ===END=== 为止。
- 文件内容直接输出原始代码，不要用代码块包裹。
- 已通过的检查项不需要为它生成修复。
- 如果确实无法修复，在 SUMMARY 中说明原因，不输出 FILE 部分。`;

  const requestBody = {
    model: AI_MODEL,
    temperature: 0.3,
    max_tokens: 16384,
    messages: [
      {
        role: 'system',
        content:
          '你是资深全栈工程师，擅长排查和修复 CI 构建错误。必须按指定分隔符格式输出修复后的完整文件内容，禁止敷衍回复。',
      },
      { role: 'user', content: prompt },
    ],
  };

  log(`第 ${attempt}/${maxAttempts} 次调用 AI API...`);
  log(`API 地址：${AI_API_BASE}`);
  log(`模型：${AI_MODEL}`);
  log(`prompt 长度：约 ${prompt.length} 字符，上下文文件数：${context.fileCount}`);

  const res = await fetch(AI_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`${TAG} AI API 失败：${res.status}`);
    console.error(`${TAG} 响应内容：${text.slice(0, 1000)}`);
    throw new Error(`AI API 请求失败：${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error(`${TAG} API 返回数据：`, JSON.stringify(data).slice(0, 1000));
    throw new Error('AI API 没有返回内容');
  }
  log(`模型返回内容长度：${content.length} 字符`);
  log(`返回内容预览：${content.slice(0, 200)}`);
  return parseDelimiterFormat(content);
}

// ===== 应用修改 =====
function applyChanges(changes) {
  const applied = [];
  for (const change of changes) {
    const filePath = String(change.path || '').trim();
    // 去除文件内容起始的换行和末尾空白，保留中间内容
    const content =
      typeof change.content === 'string' ? change.content.replace(/^\n+/, '').replace(/\s+$/, '') : null;
    if (!filePath || content === null) continue;
    if (!isSafePath(filePath)) {
      warn(`跳过不安全路径：${filePath}`);
      continue;
    }
    const dir = path.dirname(filePath);
    if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
    applied.push(filePath);
    log(`已写入：${filePath}（${content.length} 字符）`);
  }
  return applied;
}

// ===== Git 提交与推送 =====
function gitConfig() {
  runShell('git config user.name "github-actions[bot]"');
  runShell('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
}

function commitAndPush(attempt, summary, appliedFiles) {
  gitConfig();

  // 只添加 AI 修改过的文件，避免提交日志文件等临时产物
  if (!appliedFiles.length) {
    warn('没有可提交的文件改动。');
    return false;
  }
  const addArgs = appliedFiles.map((f) => `"${f}"`).join(' ');
  const addResult = runShell(`git add -- ${addArgs}`);
  if (!addResult.ok) {
    warn(`git add 失败：${addResult.output.slice(0, 500)}`);
    return false;
  }

  // 检查暂存区是否有改动
  const diffCheck = runShell('git diff --cached --quiet');
  if (diffCheck.ok) {
    log('暂存区没有改动，跳过提交。');
    return false;
  }

  const commitMsg = `fix(ci): AI 自动修复 lint/build 错误 (尝试 ${attempt}/${maxAttempts})

${summary || 'AI 自动修复 CI 失败'}`;
  const msgFile = '/tmp/auto-ci-fix-commit-msg.txt';
  try {
    writeFileSync(msgFile, commitMsg, 'utf8');
  } catch (e) {
    warn(`写入提交信息文件失败：${e.message}`);
    return false;
  }

  const commitResult = runShell(`git commit -F ${msgFile}`);
  if (!commitResult.ok) {
    warn(`git commit 失败：${commitResult.output.slice(0, 500)}`);
    return false;
  }

  // 推送到当前所在分支（即 PR 分支）
  const branchResult = runShell('git rev-parse --abbrev-ref HEAD');
  const branch = branchResult.output.trim();
  if (!branch || branch === 'HEAD') {
    warn('无法确定当前分支，跳过推送。');
    return false;
  }
  const pushResult = runShell(`git push origin HEAD:${branch}`);
  if (!pushResult.ok) {
    warn(`git push 失败：${pushResult.output.slice(0, 1000)}`);
    return false;
  }
  log(`已提交并推送到分支 ${branch}`);
  return true;
}

// ===== PR 评论 =====
function commentOnPr(body) {
  const file = '/tmp/auto-ci-fix-comment.md';
  try {
    writeFileSync(file, body, 'utf8');
  } catch (e) {
    warn(`写入评论文件失败：${e.message}`);
    return;
  }
  const result = runShell(`gh pr comment ${PR_NUMBER} --body-file ${file}`);
  if (result.ok) {
    log('已发布 PR 评论。');
  } else {
    warn(`发布 PR 评论失败：${result.output.slice(0, 500)}`);
  }
}

// ===== 主流程 =====
log(`开始处理 PR #${PR_NUMBER}，最大重试次数：${maxAttempts}`);
log(`仓库：${GITHUB_REPOSITORY || '(未设置)'}`);
log(`初始状态：lint=${LINT_FAILED}, build=${BUILD_FAILED}`);

let lintFailed = LINT_FAILED === 'true';
let buildFailed = BUILD_FAILED === 'true';
let lintLog = '';
let buildLog = '';

// 读取工作流预先生成的日志
try {
  lintLog = existsSync(LINT_LOG_PATH) ? readFileSync(LINT_LOG_PATH, 'utf8') : '';
} catch {
  lintLog = '';
}
try {
  buildLog = existsSync(BUILD_LOG_PATH) ? readFileSync(BUILD_LOG_PATH, 'utf8') : '';
} catch {
  buildLog = '';
}

// 若标记为失败但缺少日志，则主动运行一次以获取日志
if (lintFailed && !lintLog) {
  log('缺少 lint 日志，主动运行一次以获取错误信息...');
  const r = runCheck('npm run lint', LINT_LOG_PATH);
  lintLog = r.log;
}
if (buildFailed && !buildLog) {
  log('缺少 build 日志，主动运行一次以获取错误信息...');
  const r = runCheck('npm run build', BUILD_LOG_PATH);
  buildLog = r.log;
}

gitConfig();

let attempt = 0;
const appliedFilesAll = [];
const summaries = [];
let lastError = '';

while ((lintFailed || buildFailed) && attempt < maxAttempts) {
  attempt++;
  log(`===== 第 ${attempt}/${maxAttempts} 次修复尝试 =====`);

  const context = collectContext(lintLog, buildLog);

  let result;
  try {
    result = await callAi({ lintFailed, buildFailed, lintLog, buildLog, context, attempt });
  } catch (err) {
    lastError = err.message;
    warn(`AI 调用失败：${err.message}`);
    break;
  }

  const summary = result.summary || 'AI 自动修复';
  summaries.push(summary);
  log(`修复摘要：${summary}`);

  if (!result.changes || result.changes.length === 0) {
    warn('AI 没有生成文件改动，停止重试。');
    break;
  }

  const applied = applyChanges(result.changes);
  appliedFilesAll.push(...applied);
  log(`本次应用 ${applied.length} 个文件改动。`);

  const pushed = commitAndPush(attempt, summary, applied);
  if (!pushed) {
    warn('未能提交/推送改动，停止重试。');
    break;
  }

  // 重新运行检查验证修复效果
  log('重新运行 lint/build 验证修复效果...');
  if (lintFailed) {
    const r = runCheck('npm run lint', LINT_LOG_PATH);
    lintFailed = !r.ok;
    lintLog = r.log;
    log(`lint 验证：${r.ok ? '通过' : '仍失败'}`);
  }
  if (buildFailed) {
    const r = runCheck('npm run build', BUILD_LOG_PATH);
    buildFailed = !r.ok;
    buildLog = r.log;
    log(`build 验证：${r.ok ? '通过' : '仍失败'}`);
  }

  if (!lintFailed && !buildFailed) {
    log('lint/build 全部通过，修复成功！');
    break;
  }

  lastError = [lintFailed ? lintLog : '', buildFailed ? buildLog : '']
    .filter(Boolean)
    .join('\n\n---\n\n');
}

// ===== 汇总并发布 PR 评论 =====
const success = !lintFailed && !buildFailed;
const uniqueFiles = Array.from(new Set(appliedFilesAll));
const stillFailing = [lintFailed ? 'lint' : '', buildFailed ? 'build' : '']
  .filter(Boolean)
  .join(' 和 ');

let body;
if (success) {
  body = [
    '## CI 自动修复成功',
    '',
    `经过 ${attempt || 0} 次尝试，lint/build 已全部通过。`,
    '',
    '### 修复摘要',
    ...(summaries.length ? summaries.map((s, i) => `${i + 1}. ${s}`) : ['- AI 自动修复']),
    '',
    '### 修改文件',
    ...(uniqueFiles.length ? uniqueFiles.map((f) => `- \`${f}\``) : ['- 无文件改动']),
    '',
  ].join('\n');
} else {
  body = [
    '## CI 自动修复未完全成功',
    '',
    `经过 ${attempt || 0} 次尝试后，${stillFailing || '检查项'} 仍失败，请人工介入。`,
    '',
    '### 已应用的修复',
    ...(summaries.length ? summaries.map((s, i) => `${i + 1}. ${s}`) : ['- 未生成修复']),
    '',
    '### 已修改文件',
    ...(uniqueFiles.length ? uniqueFiles.map((f) => `- \`${f}\``) : ['- 无文件改动']),
    '',
    '### 剩余问题（日志片段）',
    '```',
    truncate(lastError, 4000) || '(无日志)',
    '```',
    '',
    '> 请人工检查上述错误日志并继续修复。',
    '',
  ].join('\n');
}

commentOnPr(body);

if (success) {
  log('完成：CI 修复成功。');
  process.exit(0);
}
log('完成：CI 修复未成功，请人工介入。');
process.exit(1);
