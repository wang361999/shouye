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
  AI_MODEL = 'gemini-2.5-flash',
} = process.env;

const MAX_CONTEXT_CHARS = 5_000;
const MAX_FILE_CHARS = 1_200;
const MAX_SELECTED_FILES = 10;
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
  if (file.startsWith('app/')) score += 2;
  if (file.startsWith('components/')) score += 2;
  if (file.startsWith('lib/')) score += 2;
  if (file.startsWith('docs/')) score += 1;
  if (file === 'package.json') score += 4;
  if (file === 'prisma/schema.prisma') score += 1;
  return score;
}

function collectContext(issue) {
  const files = run('git', ['ls-files'])
    .split('\n')
    .filter(Boolean)
    .filter(isSafePath);

  const issueText = `${issue.title}\n\n${issue.body || ''}`;
  const keywords = tokenize(issueText);
  const mustInclude = new Set([
    'package.json',
    'app/api/admin/auto-iteration/route.ts',
    'docs/free-ai-iteration-guide.md',
  ]);

  const selected = files
    .map((file) => ({ file, score: mustInclude.has(file) ? 99 : scoreFile(file, keywords) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SELECTED_FILES)
    .map((item) => item.file);

  let context = '';
  for (const file of selected) {
    if (!existsSync(file) || !statSync(file).isFile()) continue;
    const content = readFileSync(file, 'utf8').slice(0, MAX_FILE_CHARS);
    const block = `\n\n--- FILE: ${file} ---\n${content}`;
    if (context.length + block.length > MAX_CONTEXT_CHARS) break;
    context += block;
  }

  return {
    tree: files.slice(0, 200).join('\n'),
    context,
    selectedCount: selected.length,
  };
}

function extractJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    fail('模型没有返回 JSON 对象');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

async function callModel(issue, repoContext) {
  const prompt = `
你是这个开源免费项目的自动代码迭代执行器。请根据 GitHub Issue 需求直接生成安全、最小、可验证的代码改动。

硬性边界：
1. 免费订单、免费授权、普通用户权限和后台功能可以自动迭代。
2. 禁止泄露、生成或改写真实密钥、Token、数据库密码、OAuth Secret、Vercel Token。
3. 禁止删除生产数据，禁止删除表、删除字段、批量清空或不可回滚的数据迁移。
4. 真实支付、扣款、退款、外部计费或任何会产生费用的操作，只能写说明，不能自动实现。
5. 不要修改 node_modules、.next、.env、.env.local、prisma/migrations。
6. 尽量不引入新依赖；如果必须引入，说明原因。

输出格式必须是严格 JSON，不要 Markdown，不要解释文字：
{
  "summary": "一句话说明本次改动",
  "details": ["改动点 1", "改动点 2"],
  "changes": [
    {
      "path": "相对仓库根目录的文件路径",
      "content": "该文件修改后的完整内容"
    }
  ]
}

如果需求不清楚或风险过高，返回 changes: []，并在 summary/details 里说明原因。

仓库：${GITHUB_REPOSITORY}

Issue 标题：
${issue.title}

Issue 内容：
${issue.body || ''}

仓库文件列表：
${repoContext.tree}

相关文件内容：
${repoContext.context}
`;

  const requestBody = {
    model: AI_MODEL,
    temperature: 0.2,
    max_tokens: 3_500,
    messages: [
      {
        role: 'system',
        content: '你是谨慎的开源项目代码维护者，只输出严格 JSON。',
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
  return extractJson(content);
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
