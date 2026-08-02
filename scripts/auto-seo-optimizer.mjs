#!/usr/bin/env node

/**
 * 自动 SEO 优化脚本
 * 扫描 app/ 下的 page.tsx 和 layout.tsx，检测缺失的 SEO metadata
 * （metadata 导出、title、description、openGraph 等），
 * 调用 AI 为缺少 SEO 的页面生成 metadata 代码并写入文件，
 * 最后生成 AI_ITERATION_SUMMARY.md。
 *
 * 用法：在 GitHub Actions 中运行
 * 环境变量：AI_API_KEY, AI_API_BASE, AI_MODEL, GITHUB_TOKEN, GITHUB_REPOSITORY
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { callAI, checkAIHealth, siteFetch } from './lib/ai-client.mjs';

const {
  GITHUB_TOKEN = '',
  GITHUB_REPOSITORY = '',
} = process.env;

const MAX_FILE_CHARS = 15_000;
const MAX_CONTEXT_CHARS = 120_000;
const MAX_SELECTED_FILES = 20;
const SUMMARY_PATH = 'AI_ITERATION_SUMMARY.md';

function fail(message) {
  console.error(`::error::[auto-seo-optimizer] ${message}`);
  process.exit(1);
}

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

// ===== 安全路径校验 =====
function isTextFile(file) {
  const allowedExts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.md'];
  return allowedExts.some((ext) => file.endsWith(ext));
}

function isSafePath(filePath) {
  const normalized = path.posix.normalize(filePath);
  if (normalized.startsWith('../') || normalized.startsWith('/')) return false;
  if (normalized.includes('/.git/')) return false;
  if (normalized === '.env' || normalized === '.env.local') return false;
  if (normalized.includes('node_modules/') || normalized.includes('.next/')) return false;
  if (normalized.includes('prisma/migrations/')) return false;
  // 不允许直接改写 prisma/schema.prisma（安全底线）
  if (normalized === 'prisma/schema.prisma') return false;
  return isTextFile(normalized);
}

// ===== 收集 app/ 下的 page.tsx 和 layout.tsx =====
function collectPageFiles() {
  const allFiles = run('git', ['ls-files']).split('\n').filter(Boolean);
  return allFiles.filter(
    (file) =>
      file.startsWith('app/') &&
      (file.endsWith('/page.tsx') || file.endsWith('/layout.tsx') || file === 'app/page.tsx' || file === 'app/layout.tsx'),
  );
}

// ===== 分析单个文件的 SEO 状态 =====
function analyzeSeo(content) {
  // 'use client' 指令必须出现在文件最前面
  const trimmed = content.replace(/^\uFEFF/, '');
  const isClient = /^['"]use client['"]/.test(trimmed);

  const hasMetadata =
    /export\s+const\s+metadata\s*[:=]/.test(content) ||
    /export\s+async\s+function\s+generateMetadata\b/.test(content);

  // 只统计 metadata 相关上下文中的字段，避免误判业务代码里的同名属性
  const hasTitle = /title\s*:/.test(content);
  const hasDescription = /description\s*:/.test(content);
  const hasOpenGraph = /openGraph\s*:/.test(content);
  const hasTwitter = /twitter\s*:|twitterCard\s*:/.test(content);
  const hasKeywords = /keywords\s*:/.test(content);

  return { isClient, hasMetadata, hasTitle, hasDescription, hasOpenGraph, hasTwitter, hasKeywords };
}

// ===== 判断文件是否需要 SEO 优化 =====
// 服务端组件（非 'use client'）才能直接导出 metadata。
// 客户端组件无法导出 metadata，需要依赖最近的 layout.tsx。
function needsSeoOptimization(analysis) {
  // 客户端组件本身不能导出 metadata，但仍可能需要在其所属 layout 补充 SEO
  // 这里只把「服务端组件且 SEO 不完整」标记为直接需要修改
  if (analysis.isClient) return false;

  if (!analysis.hasMetadata) return true;
  if (!analysis.hasOpenGraph) return true;
  if (!analysis.hasDescription) return true;
  if (!analysis.hasTitle) return true;
  return false;
}

// ===== 构建扫描报告 =====
function buildScanReport() {
  const pageFiles = collectPageFiles();
  const report = [];
  const needingOptimization = [];
  const layouts = [];

  for (const file of pageFiles) {
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    const content = readFileSync(file, 'utf8');
    const analysis = analyzeSeo(content);
    const isLayout = file.endsWith('/layout.tsx') || file === 'app/layout.tsx';
    const needs = needsSeoOptimization(analysis);

    report.push({
      file,
      isClient: analysis.isClient,
      isLayout,
      hasMetadata: analysis.hasMetadata,
      hasTitle: analysis.hasTitle,
      hasDescription: analysis.hasDescription,
      hasOpenGraph: analysis.hasOpenGraph,
      needs,
    });

    if (isLayout) layouts.push(file);
    if (needs) needingOptimization.push(file);
  }

  return { report, needingOptimization, layouts, pageFiles };
}

// ===== 构建上下文（需要修改的文件 + 相关 layout 的完整内容） =====
function buildContext(scan) {
  // 优先包含需要优化的文件，再补充 layout 文件（客户端页面靠 layout 补 SEO）
  const candidateFiles = new Set([...scan.needingOptimization, ...scan.layouts]);

  let context = '';
  const included = [];
  let totalChars = 0;

  for (const file of candidateFiles) {
    if (included.length >= MAX_SELECTED_FILES) break;
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    const content = readFileSync(file, 'utf8').slice(0, MAX_FILE_CHARS);
    const block = `\n\n--- FILE: ${file} ---\n${content}`;
    if (totalChars + block.length > MAX_CONTEXT_CHARS) break;
    context += block;
    totalChars += block.length;
    included.push(file);
  }

  // 扫描报告表格
  const tableRows = scan.report
    .map((r) => {
      const tags = [
        r.isClient ? 'client' : 'server',
        r.isLayout ? 'layout' : 'page',
        r.hasMetadata ? 'metadata' : 'no-metadata',
        r.hasOpenGraph ? 'og' : 'no-og',
      ].join(', ');
      return `- ${r.file} → ${tags}${r.needs ? '  [需优化]' : ''}`;
    })
    .join('\n');

  return {
    context,
    included,
    table: tableRows,
    totalFiles: scan.pageFiles.length,
    needingCount: scan.needingOptimization.length,
  };
}

// ===== 解析分隔符格式输出 =====
function parseDelimiterFormat(text) {
  const summaryMatch = text.match(/===SUMMARY===\s*([\s\S]*?)(?=\n===|$)/i);
  const detailsMatch = text.match(/===DETAILS===\s*([\s\S]*?)(?=\n===|$)/i);

  const summary = summaryMatch ? summaryMatch[1].trim() : 'AI SEO 优化完成';
  const details = detailsMatch
    ? detailsMatch[1].trim().split('\n').filter((l) => l.trim()).map((l) => l.replace(/^[-*]\s*/, '').trim())
    : [];

  // ===FILE: path=== 内容（直到下一个 ===FILE: 或 ===END===）
  const fileRegex = /===FILE:\s*(.+?)\s*===\s*([\s\S]*?)(?=\n===FILE:|\n===END===|$)/g;
  const changes = [];
  let match;
  while ((match = fileRegex.exec(text)) !== null) {
    changes.push({ path: match[1].trim(), content: match[2] });
  }

  if (changes.length === 0 && !summaryMatch) return null;
  return { summary, details, changes };
}

function parseResponse(text) {
  const delimResult = parseDelimiterFormat(text);
  if (delimResult) {
    console.log('[auto-seo-optimizer] 分隔符格式解析成功');
    return delimResult;
  }

  console.error(`::error::[auto-seo-optimizer] 模型返回内容（前 800 字符）：${text.slice(0, 800)}`);
  fail('无法解析模型返回内容（分隔符格式解析失败）');
}

// ===== 调用 AI =====
async function callModel(scan, repoContext) {
  const prompt = `你是一个专业的 Next.js SEO 工程师，正在维护这个开源项目。请为缺少 SEO metadata 的页面生成完整的 metadata 代码。

## 工作原则

1. 仔细阅读提供的页面文件和 layout 文件，理解每个页面的用途。
2. 为缺少 metadata 的「服务端组件」页面（page.tsx / layout.tsx，不含 'use client'）添加 metadata 导出或 generateMetadata 函数。
3. 对于 'use client' 客户端组件页面，无法直接导出 metadata，请在它最近的、同目录或上级目录的 layout.tsx 中补充 metadata（如果该 layout 是服务端组件）。
4. metadata 必须包含：title、description、keywords、openGraph（含 title、description、type、locale）、twitter 卡片。
5. 根路由 app/layout.tsx 已有 generateMetadata（从数据库读取站点名），请保留其现有逻辑，只补充缺失的 openGraph / twitter / metadataBase 等字段，不要破坏数据库读取逻辑。
6. title 用模板字符串格式（如 \`页面名 - 站点名\`），description 要准确描述页面内容，keywords 用相关技术词。
7. openGraph.type 默认 'website'，locale 用 'zh_CN'。
8. 只修改必要的文件，不要做无关改动，不要改动业务逻辑代码。
9. 确保 TypeScript 类型正确，需要时 import type { Metadata } from 'next'。

## 安全底线（绝对不能违反）

本项目部署在 Vercel Hobby（免费版），以下规则必须绝对遵守：

1. 禁止引入任何新的 npm 依赖，不要修改 package.json。
2. 禁止修改 next.config.mjs / next.config.js / vercel.json / middleware.ts。
3. 禁止修改 prisma/schema.prisma 和 prisma/migrations 目录。
4. 禁止修改 node_modules、.next、.env、.env.local。
5. 项目使用 React 18 + Next.js 14，禁止使用 React 19+ API 或 Next.js 15+ API。
6. 只修改 app/ 下的 page.tsx / layout.tsx 的 metadata 部分，不要改动业务逻辑代码。
7. 确保改动后 npm run lint 和 npm run build 能通过。
8. 不要泄露密钥、Token、密码。
9. 每次改动不超过 10 个文件。

## 输出格式

用以下分隔符格式输出（不要用 JSON，不要用 Markdown 代码块包裹文件内容）：

===SUMMARY===
一句话说明本次 SEO 优化改动
===DETAILS===
- 改动点 1
- 改动点 2
===FILE: 相对仓库根目录的文件路径===
该文件修改后的完整内容
===FILE: 另一个文件路径===
该文件修改后的完整内容
===END===

注意：
- 每个 ===FILE: 后面跟着文件路径，下一行开始就是文件完整内容，直到下一个 ===FILE: 或 ===END=== 为止。
- 文件内容不要用代码块包裹，直接输出原始代码。
- 如果所有页面 SEO 都已完整，在 SUMMARY 中说明已检查的文件和结论，不输出 FILE 部分。

## 仓库信息

仓库：${GITHUB_REPOSITORY || '未知'}

## 扫描报告

共扫描 ${repoContext.totalFiles} 个页面文件，其中 ${repoContext.needingCount} 个需要优化。

${repoContext.table}

## 相关代码文件

${repoContext.context}
`;

  const systemPrompt =
    '你是专业的 Next.js SEO 工程师。你只负责为页面补充 SEO metadata，不做无关改动。按照指定的分隔符格式输出，文件内容直接输出原始代码，不要用代码块包裹。';

  console.log('[auto-seo-optimizer] 调用 AI API...');
  console.log(`[auto-seo-optimizer] prompt 长度：约 ${prompt.length} 字符`);
  console.log(`[auto-seo-optimizer] 上下文文件数：${repoContext.included.length}`);
  console.log(`[auto-seo-optimizer] 需要优化的文件数：${repoContext.needingCount}`);

  const content = await callAI({
    prompt,
    systemPrompt,
    maxTokens: 16_384,
    tag: '[auto-seo-optimizer]',
  });

  console.log(`[auto-seo-optimizer] 模型返回内容长度：${content.length} 字符`);
  console.log(`[auto-seo-optimizer] 返回内容预览：${content.slice(0, 200)}`);
  return parseResponse(content);
}

// ===== 应用改动 =====
function applyChanges(result) {
  const changes = Array.isArray(result.changes) ? result.changes : [];
  const applied = [];
  const skipped = [];

  for (const change of changes) {
    const filePath = String(change.path || '').trim();
    const content = typeof change.content === 'string' ? change.content : null;
    if (!filePath || content === null) continue;
    if (!isSafePath(filePath)) {
      console.warn(`[auto-seo-optimizer] 跳过不安全路径：${filePath}`);
      skipped.push(filePath);
      continue;
    }
    // 只允许修改 app/ 下的 page.tsx / layout.tsx，防止 AI 越权改动
    if (!filePath.startsWith('app/') || !(filePath.endsWith('/page.tsx') || filePath.endsWith('/layout.tsx') || filePath === 'app/page.tsx' || filePath === 'app/layout.tsx')) {
      console.warn(`[auto-seo-optimizer] 跳过非目标文件（仅限 app/ 下的 page.tsx/layout.tsx）：${filePath}`);
      skipped.push(filePath);
      continue;
    }

    writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
    applied.push(filePath);
    console.log(`[auto-seo-optimizer] 已写入：${filePath}`);
  }

  const summary = [
    `# AI 自动 SEO 优化结果`,
    ``,
    `模型：由共享 AI 客户端模块管理`,
    `仓库：${GITHUB_REPOSITORY || '未知'}`,
    `执行时间：${new Date().toISOString()}`,
    ``,
    `## 摘要`,
    ``,
    result.summary || '模型未提供摘要。',
    ``,
    `## 细节`,
    ``,
    ...(Array.isArray(result.details) && result.details.length
      ? result.details.map((item) => `- ${item}`)
      : ['- 模型未提供细节。']),
    ``,
    `## 已写入文件`,
    ``,
    ...(applied.length ? applied.map((file) => `- \`${file}\``) : ['- 未写入文件。']),
    ``,
    ...(skipped.length
      ? [`## 已跳过文件（安全限制）`, ``, ...skipped.map((file) => `- \`${file}\``), ``]
      : []),
  ].join('\n');

  writeFileSync(SUMMARY_PATH, summary, 'utf8');
  return applied;
}

// ===== 主流程 =====
console.log('[auto-seo-optimizer] 开始扫描 app/ 下的页面文件...');

const scan = buildScanReport();
console.log(`[auto-seo-optimizer] 扫描完成：共 ${scan.pageFiles.length} 个页面文件，${scan.needingOptimization.length} 个需要 SEO 优化。`);

if (scan.needingOptimization.length === 0) {
  console.log('[auto-seo-optimizer] 所有页面 SEO 已完整，无需优化。');

  const summary = [
    `# AI 自动 SEO 优化结果`,
    ``,
    `模型：由共享 AI 客户端模块管理`,
    `仓库：${GITHUB_REPOSITORY || '未知'}`,
    `执行时间：${new Date().toISOString()}`,
    ``,
    `## 摘要`,
    ``,
    `所有页面 SEO metadata 已完整，本次无需优化。`,
    ``,
    `## 扫描报告`,
    ``,
    ...scan.report.map((r) => `- ${r.file} → ${r.isClient ? 'client' : 'server'}, ${r.hasMetadata ? '有 metadata' : '无 metadata'}, ${r.hasOpenGraph ? '有 OG' : '无 OG'}`),
    ``,
    `## 已写入文件`,
    ``,
    `- 未写入文件。`,
    ``,
  ].join('\n');
  writeFileSync(SUMMARY_PATH, summary, 'utf8');
  console.log('[auto-seo-optimizer] 完成，未生成代码改动。');
  process.exit(0);
}

const repoContext = buildContext(scan);

const health = await checkAIHealth('[auto-seo-optimizer]');
if (!health) {
  fail('AI API 预检失败，请检查 AI_API_KEY 和 AI_MODEL 配置');
}

const result = await callModel(scan, repoContext);
const applied = applyChanges(result);

console.log(`[auto-seo-optimizer] 完成！已应用 ${applied.length} 个文件改动。`);
