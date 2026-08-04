#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { callAI, checkAIHealth, siteFetch, robustJSONParse } from './lib/ai-client.mjs';

const {
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
  ISSUE_NUMBER,
} = process.env;

const MAX_CONTEXT_CHARS = 120_000;
const MAX_FILE_CHARS = 15_000;
const MAX_SELECTED_FILES = 30;
const SUMMARY_PATH = 'AI_ITERATION_SUMMARY.md';

function fail(message) {
  console.error(`::error::[free-ai-issue-executor] ${message}`);
  process.exit(1);
}

if (!GITHUB_TOKEN) fail('缺少 GITHUB_TOKEN');
if (!GITHUB_REPOSITORY) fail('缺少 GITHUB_REPOSITORY');
if (!ISSUE_NUMBER) fail('缺少 ISSUE_NUMBER');

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

async function githubFetch(url, options = {}) {
  const res = await siteFetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    fail(`GitHub API 请求失败：${res.status} ${text}`);
  }

  return res.json();
}

function isTextFile(file) {
  const allowedExts = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.md',
    '.yml', '.yaml', '.css', '.scss', '.html', '.prisma', '.env.example',
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
  // Vercel 安全：禁止修改构建配置和中间件
  if (normalized === 'next.config.mjs' || normalized === 'next.config.js') return false;
  if (normalized === 'vercel.json') return false;
  if (normalized === 'middleware.ts' || normalized === 'middleware.js') return false;
  // Vercel 安全：禁止修改 package.json（防止引入新依赖或升级版本）
  if (normalized === 'package.json') return false;
  if (normalized === 'package-lock.json' || normalized === 'yarn.lock') return false;
  // Vercel 安全：禁止修改 prisma schema（防止数据库结构变更导致崩溃）
  if (normalized === 'prisma/schema.prisma') return false;
  return isTextFile(normalized);
}

function tokenize(text) {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\/\-_]+/gu, ' ')
        .split(/\s+/)
        .filter((item) => item.length >= 2),
    ),
  );
}

function scoreFile(file, keywords) {
  const lower = file.toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (lower.includes(keyword)) score += keyword.length > 4 ? 3 : 1;
  }
  if (file.startsWith('app/')) score += 3;
  if (file.startsWith('components/')) score += 2;
  if (file.startsWith('lib/')) score += 2;
  if (file.startsWith('docs/')) score += 1;
  if (file === 'package.json') score += 5;
  if (file === 'prisma/schema.prisma') score += 2;
  if (file === 'next.config.mjs' || file === 'next.config.js') score += 3;
  if (file === 'middleware.ts' || file === 'middleware.js') score += 3;
  return score;
}

function collectContext(issue) {
  const files = run('git', ['ls-files'])
    .split('\n')
    .filter(Boolean)
    .filter(isSafePath);

  const issueText = `${issue.title}\n\n${issue.body || ''}`;
  const keywords = tokenize(issueText);

  // 根据 issue 内容智能选择相关文件
  const selected = files
    .map((file) => ({ file, score: scoreFile(file, keywords) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SELECTED_FILES)
    .map((item) => item.file);

  let context = '';
  let actualCount = 0;
  for (const file of selected) {
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    const content = readFileSync(file, 'utf8').slice(0, MAX_FILE_CHARS);
    const block = `\n\n--- FILE: ${file} ---\n${content}`;
    if (context.length + block.length > MAX_CONTEXT_CHARS) break;
    context += block;
    actualCount++;
  }

  return {
    tree: files.slice(0, 300).join('\n'),
    context,
    selectedCount: actualCount,
  };
}

function extractJson(text) {
  try {
    return robustJSONParse(text);
  } catch (err) {
    console.error('[free-ai-issue-executor] JSON 解析失败：', err.message);
    return null;
  }
}

function parseDelimiterFormat(text) {
  const summaryMatch = text.match(/===SUMMARY===\s*([\s\S]*?)(?=\n===|$)/i);
  const detailsMatch = text.match(/===DETAILS===\s*([\s\S]*?)(?=\n===|$)/i);

  const summary = summaryMatch ? summaryMatch[1].trim() : 'AI 迭代完成';
  const details = detailsMatch
    ? detailsMatch[1].trim().split('\n').filter((l) => l.trim()).map((l) => l.replace(/^[-*]\s*/, '').trim())
    : [];

  const fileRegex = /===FILE:\s*(.+?)\s*===\s*([\s\S]*?)(?=\n===FILE:|\n===END===|$)/g;
  const changes = [];
  let match;
  while ((match = fileRegex.exec(text)) !== null) {
    changes.push({ path: match[1].trim(), content: match[2].trim() });
  }

  if (changes.length === 0 && !summaryMatch) return null;
  return { summary, details, changes };
}

function parseResponse(text) {
  // Try JSON first
  const jsonResult = extractJson(text);
  if (jsonResult) return jsonResult;

  // Fall back to delimiter format
  console.error('[free-ai-issue-executor] 尝试分隔符格式解析...');
  const delimResult = parseDelimiterFormat(text);
  if (delimResult) {
    console.log('[free-ai-issue-executor] 分隔符格式解析成功');
    return delimResult;
  }

  console.error(`::error::[free-ai-issue-executor] 模型返回内容（前 800 字符）：${text.slice(0, 800)}`);
  fail('无法解析模型返回内容（JSON 和分隔符格式均失败）');
}

async function callModel(issue, repoContext) {
  const prompt = `你是一个专业的全栈开发工程师和产品架构师，正在维护这个开源项目。请认真分析 Issue 需求，仔细阅读代码，找到问题根因并给出高质量、低风险的实现或修复。

## 工作原则

1. 必须认真阅读提供的代码文件，理解项目结构和路由逻辑，不要敷衍说"没问题"。
2. 如果用户报告 404、白屏、报错等问题，必须找到具体原因并修复，不能回复"没发现问题"。
3. 先判断 Issue 类型：缺陷修复 / 功能增强 / UI 优化 / 文档补充 / 配置问题，再选择最小改动方案。
4. 只实现 Issue 明确要求或能从上下文直接推导出的内容，不要借题发挥做无关功能。
5. 改动必须保持现有风格：复用已有组件、工具函数、API 结构、错误处理和权限校验。
6. 如果当前提供的代码不足以定位问题，在 SUMMARY 和 DETAILS 中说明已检查的文件、缺少的信息、建议下一步，不输出 FILE 部分。

## Vercel 免费版安全红线（违反任何一条都会导致网站崩溃）

本项目部署在 Vercel Hobby（免费版），有严格的资源限制。以下规则必须绝对遵守：

### 依赖与构建
1. 禁止引入任何新的 npm 依赖。项目现有依赖已足够，不要在 package.json 中添加任何新包。
2. 禁止修改 package.json 中的依赖版本号（不要升级 React、Next.js、Prisma 等任何包）。
3. 禁止修改 next.config.mjs / next.config.js（构建配置改动可能导致部署失败）。
4. 禁止修改 vercel.json（如果存在）。
5. 确保改动后 npm run lint 和 npm run build 能通过。

### React / Next.js 兼容性
6. 项目使用 React 18 和 Next.js 14，禁止使用 React 19+ 的 API（如 use() 钩子、useFormState、useFormStatus）。
7. 禁止使用 Next.js 15+ 的 API（如 async params、async searchParams）。
8. 'use client' 指令必须在文件第一行，客户端组件不能导出 metadata。
9. 动态路由的 params 在 Next.js 14 中是同步对象，不要用 await 或 use() 解包。

### 数据库与 API
10. 禁止修改 prisma/schema.prisma 的已有字段（可以新增字段，不能删除或修改已有字段）。
11. 禁止修改 prisma/migrations 目录。
12. 禁止创建会消耗大量数据库连接的代码（避免 N+1 查询，使用 Promise.all 并行查询）。
13. API 路由必须有 try-catch 错误处理，失败时返回有意义的错误信息而不是 500 崩溃。
14. 禁止创建需要额外环境变量的功能（除非确认该环境变量已在 Vercel 中配置）。

### 前端安全
15. 所有 fetch 请求必须设置 8 秒超时（使用 AbortController），超时后显示错误提示而不是无限加载。
16. 禁止删除现有的错误处理、加载状态、超时处理代码。
17. 页面必须有 loading skeleton 和 error fallback，不能让用户看到无限加载或白屏。
18. 禁止使用大量内联动画或重型客户端组件，避免超出 Vercel 函数大小限制（4MB）。

### 文件安全
19. 禁止修改 node_modules、.next、.env、.env.local。
20. 禁止修改 middleware.ts（中间件影响所有请求，改动可能导致全站不可访问）。
21. 禁止泄露、生成或改写真实密钥、Token、数据库密码。
22. 禁止删除生产数据，禁止删除表、删除字段、批量清空数据。
23. 真实支付、扣款、退款操作只能写说明，不能自动实现。
24. 每次改动不超过 8 个文件，优先小范围精准修复。

## 可以自由发挥的领域

1. 页面 UI 优化、响应式适配、交互反馈。
2. 后台管理功能增强，但必须保留现有权限和错误处理。
3. 论坛功能改进：发帖、评论、搜索、分类、标签。
4. 工具页面优化和 SEO 优化。
5. 免费订单、免费授权流程优化。
6. 代码质量改进，但只做与 Issue 直接相关的小范围重构。
7. 新增功能必须使用现有依赖，不引入新包，不新增必需环境变量。

## 质量要求

1. SUMMARY 写清“解决了什么问题 / 实现了什么能力”，不要只写“已优化”。
2. DETAILS 必须列出 2-5 条具体改动，包括涉及的页面/API/组件和用户可见变化。
3. 涉及接口时必须保留或补充 try-catch、权限校验、参数校验和有意义的错误信息。
4. 涉及前端时必须考虑 loading、error、empty state 和移动端布局。
5. 涉及数据写入时必须避免破坏生产数据，不做批量删除或不可逆操作。
6. 不要输出解释性长文，重点输出可应用的完整文件内容。

## 输出格式

用以下分隔符格式输出（不要用 JSON，不要用 Markdown 代码块）：

===SUMMARY===
一句话说明本次改动解决的问题和用户可见结果
===DETAILS===
- 改动点 1（具体到页面、API 或组件）
- 改动点 2（说明为什么这样改）
===FILE: 相对仓库根目录的文件路径===
该文件修改后的完整内容
===FILE: 另一个文件路径===
该文件修改后的完整内容
===END===

注意：
- 每个 ===FILE: 后面跟着文件路径，下一行开始就是文件完整内容，直到下一个 ===FILE: 或 ===END=== 为止。
- 文件内容不要用代码块包裹，直接输出原始代码。
- 如果确实没有需要修改的代码，在 SUMMARY 和 DETAILS 中详细说明你检查了哪些文件、为什么认为没有问题，不输出 FILE 部分。

## 仓库信息

仓库：${GITHUB_REPOSITORY}

## Issue 需求

标题：${issue.title}

内容：
${issue.body || ''}

## 仓库文件列表

${repoContext.tree}

## 相关代码文件

${repoContext.context}
`;

  const systemPrompt = '你是专业的全栈开发工程师。你必须仔细阅读代码、找到问题根因并做低风险修复。禁止敷衍回复"没问题"，禁止无关发挥。本项目部署在 Vercel 免费版，使用 React 18 + Next.js 14，禁止引入新依赖、禁止使用 React 19+ API、禁止修改配置文件和中间件。所有 fetch 必须有 8 秒超时和错误处理。按照指定的分隔符格式输出完整文件内容。';

  console.log('[free-ai-issue-executor] 调用 AI API...');
  console.log(`[free-ai-issue-executor] prompt 长度：约 ${prompt.length} 字符`);
  console.log(`[free-ai-issue-executor] 上下文文件数：${repoContext.selectedCount || '未知'}`);

  const content = await callAI({
    prompt,
    systemPrompt,
    maxTokens: 65_536,
    tag: '[free-ai-issue-executor]',
  });

  console.log(`[free-ai-issue-executor] 模型返回内容长度：${content.length} 字符`);
  console.log(`[free-ai-issue-executor] 返回内容预览：${content.slice(0, 200)}`);
  return parseResponse(content);
}

function applyChanges(result) {
  const changes = Array.isArray(result.changes) ? result.changes : [];
  const applied = [];

  // Vercel 安全：限制每次最多修改 8 个文件
  const MAX_CHANGES = 8;
  if (changes.length > MAX_CHANGES) {
    console.warn(`[free-ai-issue-executor] AI 尝试修改 ${changes.length} 个文件，超过上限 ${MAX_CHANGES}，只应用前 ${MAX_CHANGES} 个。`);
  }
  const limitedChanges = changes.slice(0, MAX_CHANGES);

  for (const change of limitedChanges) {
    const filePath = String(change.path || '').trim();
    const content = typeof change.content === 'string' ? change.content : null;
    if (!filePath || content === null) continue;
    if (!isSafePath(filePath)) {
      console.warn(`[free-ai-issue-executor] 跳过不安全路径：${filePath}`);
      continue;
    }

    const dir = path.dirname(filePath);
    if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
    applied.push(filePath);
  }

  if (applied.length === 0) {
    writeFileSync(SUMMARY_PATH, [
      `# AI 自动迭代结果`,
      ``,
      `模型：由共享 AI 客户端模块管理`,
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
      `- 未写入文件。`,
      ``,
    ].join('\n'), 'utf8');
    return applied;
  }

  const summary = [
    `# AI 自动迭代结果`,
    ``,
    `模型：由共享 AI 客户端模块管理`,
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
  ].join('\n');

  writeFileSync(SUMMARY_PATH, summary, 'utf8');
  return applied;
}

const [owner, repo] = GITHUB_REPOSITORY.split('/');
const issue = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/issues/${ISSUE_NUMBER}`);
const repoContext = collectContext(issue);

const health = await checkAIHealth('[free-ai-issue-executor]');
if (!health) {
  fail('AI API 预检失败，请检查 AI_API_KEY 和 AI_MODEL 配置');
}

const result = await callModel(issue, repoContext);
const applied = applyChanges(result);

console.log(`已应用 ${applied.length} 个文件改动。`);
