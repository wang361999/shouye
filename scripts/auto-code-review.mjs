#!/usr/bin/env node

/**
 * 自动代码审查脚本
 *
 * 读取 PR 的 diff（通过 gh pr diff），调用 AI 审查代码质量、安全风险、最佳实践，
 * AI 输出纯文本（Markdown）审查意见，再通过 gh pr comment 发布到 PR。
 *
 * 用法：在 GitHub Actions 中运行（见 .github/workflows/auto-code-review.yml）
 * 环境变量：
 *   AI_API_KEY      AI 接口密钥（必填）
 *   AI_API_BASE     AI 接口地址（默认 Gemini OpenAI 兼容端点）
 *   AI_MODEL        模型名（默认 gemini-3.6-flash）
 *   GH_TOKEN        GitHub Token（用于 gh 命令，必填）
 *   GITHUB_TOKEN    GitHub Token（备用）
 *   PR_NUMBER       PR 编号（必填）
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const {
  AI_API_KEY = '',
  AI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  AI_MODEL = 'gemini-3.6-flash',
  GH_TOKEN = '',
  GITHUB_TOKEN = '',
  GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || '',
  PR_NUMBER = '',
} = process.env;

const TAG = '[auto-code-review]';
const MAX_DIFF_CHARS = 100_000; // 传给 AI 的 diff 最大字符数

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

// ===== Shell 工具函数 =====
function runShell(command) {
  try {
    const stdout = execFileSync('bash', ['-c', command], {
      encoding: 'utf8',
      env: { ...process.env },
      maxBuffer: 20 * 1024 * 1024,
    });
    return { ok: true, output: stdout };
  } catch (err) {
    const output = `${err.stdout || ''}${err.stderr || ''}`;
    return { ok: false, output };
  }
}

// ===== 获取 PR diff =====
function getPrDiff() {
  log(`获取 PR #${PR_NUMBER} 的 diff...`);
  const result = runShell(`gh pr diff ${PR_NUMBER}`);
  if (!result.ok) {
    fail(`获取 PR diff 失败：${result.output.slice(0, 500)}`);
  }
  return result.output;
}

function truncate(text, max) {
  if (!text) return '';
  if (text.length <= max) return text;
  const headLen = Math.floor(max * 0.3);
  const tailLen = max - headLen;
  return `${text.slice(0, headLen)}\n\n...（diff 已截断，原文共 ${text.length} 字符，仅审查前 ${headLen} + 后 ${tailLen} 字符）...\n${text.slice(-tailLen)}`;
}

// ===== AI 调用：代码审查 =====
async function reviewDiff(diff) {
  const prompt = `你是一名严格且专业的代码审查员。请对以下 PR 的代码改动进行审查，重点关注代码质量、安全风险和最佳实践。

## 审查维度
1. **代码质量**：可读性、命名规范、重复代码、圈复杂度、错误处理是否完善。
2. **安全风险**：注入攻击、鉴权/越权、密钥/Token 泄露、XSS、敏感数据暴露、不安全的依赖使用。
3. **最佳实践**：是否符合 Next.js / React / TypeScript 规范，性能问题，类型安全，无障碍访问。
4. **潜在 Bug**：边界条件、空值/异常处理、异步错误处理、资源泄漏、竞态条件。

## 输出要求
- 用中文输出，Markdown 格式。
- 只针对有问题的部分给出建议，不要逐行复述代码。
- 每条建议要具体、可操作，尽量指出涉及的文件和大致位置。
- 按严重程度分类：严重问题、建议改进、值得肯定。
- 如果代码质量良好、没有明显问题，也要明确说明。
- 不要修改文件，只输出审查意见。

## 输出结构（请严格遵循）
## 代码审查结果

### 严重问题
（如有，逐条列出；没有则写"无"）

### 建议改进
（列出可优化的点）

### 值得肯定
（列出做得好的地方）

### 总结
一句话总体评价。

## PR diff
${truncate(diff, MAX_DIFF_CHARS)}
`;

  const requestBody = {
    model: AI_MODEL,
    temperature: 0.3,
    max_tokens: 16384,
    messages: [
      {
        role: 'system',
        content:
          '你是资深代码审查员，擅长发现代码质量、安全和最佳实践方面的问题。用中文输出结构化的 Markdown 审查意见，只输出审查意见，不要修改代码。',
      },
      { role: 'user', content: prompt },
    ],
  };

  log('调用 AI API 进行代码审查...');
  log(`API 地址：${AI_API_BASE}`);
  log(`模型：${AI_MODEL}`);
  log(`prompt 长度：约 ${prompt.length} 字符`);

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
    fail(`AI API 请求失败：${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error(`${TAG} API 返回数据：`, JSON.stringify(data).slice(0, 1000));
    fail('AI API 没有返回内容');
  }
  log(`审查结果长度：${content.length} 字符`);
  return content.trim();
}

// ===== 发布 PR 评论 =====
function commentOnPr(body) {
  const file = '/tmp/auto-code-review-comment.md';
  try {
    writeFileSync(file, body, 'utf8');
  } catch (e) {
    fail(`写入评论文件失败：${e.message}`);
  }
  const result = runShell(`gh pr comment ${PR_NUMBER} --body-file ${file}`);
  if (result.ok) {
    log('已发布代码审查评论到 PR。');
  } else {
    fail(`发布 PR 评论失败：${result.output.slice(0, 500)}`);
  }
}

// ===== 主流程 =====
log(`开始审查 PR #${PR_NUMBER}`);
log(`仓库：${GITHUB_REPOSITORY || '(未设置)'}`);

const diff = getPrDiff();

if (!diff || !diff.trim()) {
  log('PR diff 为空，跳过审查。');
  commentOnPr('## 代码审查结果\n\n该 PR 没有可审查的代码改动（diff 为空）。');
  process.exit(0);
}

log(`diff 长度：${diff.length} 字符`);

let review;
try {
  review = await reviewDiff(diff);
} catch (err) {
  fail(`代码审查失败：${err.message}`);
}

const body = `## 自动代码审查

> 由 AI 自动生成，仅供参考，请结合实际情况判断。

${review}
`;

commentOnPr(body);
log('代码审查完成。');
