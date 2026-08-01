#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const {
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
  ISSUE_NUMBER,
  AI_API_KEY = '',
  AI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  AI_MODEL = 'gemini-3.6-flash',
} = process.env;

const MAX_CONTEXT_CHARS = 120_000;
const MAX_FILE_CHARS = 15_000;
const MAX_SELECTED_FILES = 30;
const SUMMARY_PATH = 'AI_ITERATION_SUMMARY.md';

function fail(message) {
  console.error(`[free-ai-issue-executor] ${message}`);
  process.exit(1);
}

if (!GITHUB_TOKEN) fail('缺少 GITHUB_TOKEN');
if (!GITHUB_REPOSITORY) fail('缺少 GITHUB_REPOSITORY');
if (!ISSUE_NUMBER) fail('缺少 ISSUE_NUMBER');
if (!AI_API_KEY) fail('缺少 AI_API_KEY。请在 GitHub 仓库 Settings → Secrets → Actions 中添加 AI_API_KEY（免费获取：https://aistudio.google.com/apikey）');

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

async function githubFetch(url, options = {}) {
  const res = await fetch(url, {
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
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
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

  console.error('[free-ai-issue-executor] 模型返回内容（前 800 字符）：', text.slice(0, 800));
  fail('无法解析模型返回内容（JSON 和分隔符格式均失败）');
}

async function callModel(issue, repoContext) {
  const prompt = `你是一个专业的全栈开发工程师和产品架构师，正在维护这个开源项目。请认真分析 Issue 需求，仔细阅读代码，找到问题根因并修复，或者实现新功能。

## 工作原则

1. 必须认真阅读提供的代码文件，理解项目结构和路由逻辑，不要敷衍说"没问题"。
2. 如果用户报告 404、白屏、报错等问题，必须找到具体原因并修复，不能回复"没发现问题"。
3. 仔细检查路由文件、页面文件、API 路由、中间件、配置文件。
4. 积极改进项目：优化 UI、提升性能、完善功能、改善用户体验都可以做。
5. 可以发挥想象力：新增页面、优化交互、改进样式、增加实用功能都是鼓励的。
6. 如果当前提供的代码不足以定位问题，在 summary 中说明需要查看哪些文件。

## 安全底线（绝对不能违反）

1. 禁止泄露、生成或改写真实密钥、Token、数据库密码、OAuth Secret、Vercel Token。
2. 禁止删除生产数据，禁止删除表、删除字段、批量清空或不可回滚的数据迁移。
3. 真实支付、扣款、退款、外部计费或任何会产生费用的操作，只能写说明，不能自动实现。
4. 不要修改 node_modules、.next、.env、.env.local、prisma/migrations。
5. 不要修改 prisma/schema.prisma 的已有字段（可以新增字段，但不能删除或修改已有字段）。
6. 不要引入重量级新依赖；轻量工具库可以引入但要在 details 里说明原因。
7. 确保改动后 npm run lint 和 npm run build 能通过，不要搞瘫网站。

## 可以自由发挥的领域

1. 页面 UI 优化、响应式适配、交互动画。
2. 后台管理功能增强。
3. 论坛功能改进：发帖、评论、搜索、分类、标签。
4. 工具页面优化。
5. SEO 优化、性能优化。
6. 免费订单、免费授权流程优化。
7. 新增实用页面和功能。
8. 代码质量改进、重构。

## 输出格式

用以下分隔符格式输出（不要用 JSON，不要用 Markdown 代码块）：

===SUMMARY===
一句话说明本次改动
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
- 如果确实没有需要修改的代码，在 SUMMARY 中详细说明你检查了哪些文件、为什么认为没有问题，不输出 FILE 部分。

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

  const requestBody = {
    model: AI_MODEL,
    temperature: 0.3,
    max_tokens: 65_536,
    messages: [
      {
        role: 'system',
        content: '你是专业的全栈开发工程师。你必须仔细阅读代码、找到问题根因并修复。禁止敷衍回复"没问题"。按照指定的分隔符格式输出。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  console.log('[free-ai-issue-executor] 调用 AI API...');
  console.log(`[free-ai-issue-executor] API 地址：${AI_API_BASE}`);
  console.log(`[free-ai-issue-executor] 模型：${AI_MODEL}`);
  console.log(`[free-ai-issue-executor] prompt 长度：约 ${prompt.length} 字符`);
  console.log(`[free-ai-issue-executor] 上下文文件数：${repoContext.selectedCount || '未知'}`);

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
    console.error(`[free-ai-issue-executor] AI API 失败：${res.status}`);
    console.error(`[free-ai-issue-executor] 响应内容：${text.slice(0, 1000)}`);
    fail(`AI API 请求失败：${res.status} ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error('[free-ai-issue-executor] API 返回数据：', JSON.stringify(data).slice(0, 1000));
    fail('AI API 没有返回内容');
  }
  console.log(`[free-ai-issue-executor] 模型返回内容长度：${content.length} 字符`);
  console.log(`[free-ai-issue-executor] 返回内容预览：${content.slice(0, 200)}`);
  return parseResponse(content);
}

function applyChanges(result) {
  const changes = Array.isArray(result.changes) ? result.changes : [];
  const applied = [];

  for (const change of changes) {
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
      `模型：${AI_MODEL}`,
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
    `模型：${AI_MODEL}`,
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
const result = await callModel(issue, repoContext);
const applied = applyChanges(result);

console.log(`已应用 ${applied.length} 个文件改动。`);
