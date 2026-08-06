#!/usr/bin/env node

/**
 * 自动代码审查脚本
 *
 * 读取 PR 的 diff（通过 gh pr diff），调用 AI 审查代码质量、安全风险、最佳实践，
 * AI 输出纯文本（Markdown）审查意见，再通过 gh pr comment 发布到 PR。
 *
 * 用法：在 GitHub Actions 中运行（见 .github/workflows/auto-code-review.yml）
 * 环境变量：
 *   AI_MODELS_CONFIG  AI 模型配置（JSON 数组，优先级递减，推荐）
 *   AI_API_KEY      AI 接口密钥（向后兼容，单模型模式）
 *   AI_API_BASE     AI 接口地址（向后兼容）
 *   AI_MODEL        模型名（向后兼容）
 *   GH_TOKEN        GitHub Token（用于 gh 命令，必填）
 *   GITHUB_TOKEN    GitHub Token（备用）
 *   PR_NUMBER       PR 编号（必填）
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { callAI, checkAIHealth, siteFetch } from './lib/ai-client.mjs';

const {
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
  console.error(`::error::${TAG} ${message}`);
  process.exit(1);
}

// ===== 环境校验 =====
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
  const prompt = `你是一名严格、专业且务实的代码审查员。请对以下 PR 的代码改动进行审查，重点关注代码质量、安全风险、线上稳定性和最佳实践。

## 审查维度
1. **正确性**：业务逻辑是否完整，边界条件、空值、异常分支是否处理。
2. **安全风险**：注入攻击、鉴权/越权、密钥/Token 泄露、XSS、敏感数据暴露、不安全的依赖使用。
3. **稳定性**：API 超时、错误处理、加载状态、数据库查询、资源释放、竞态条件。
4. **代码质量**：可读性、命名规范、重复代码、圈复杂度、类型安全、可维护性。
5. **框架实践**：是否符合 Next.js 14 / React 18 / TypeScript 规范，是否误用了高版本 API。
6. **用户体验**：无障碍访问、移动端适配、错误提示、交互反馈。

## 输出要求
- 用中文输出，Markdown 格式。
- 只针对有问题的部分给出建议，不要逐行复述代码。
- 每条建议必须包含：影响范围、判断依据、建议修复方式。
- 尽量指出涉及的文件和大致位置；如果 diff 被截断，明确说明“基于可见 diff 判断”。
- 不要编造没有出现在 diff 中的代码或依赖，不确定时标注“需要人工确认”。
- 按严重程度分类：阻塞问题、重要建议、一般优化、值得肯定。
- 如果代码质量良好、没有明显问题，也要明确说明。
- 不要修改文件，只输出审查意见。

## 输出结构（请严格遵循）
## 代码审查结果

### 总体结论
用 2-3 句话说明是否建议合并、主要风险和需要优先处理的问题。

### 阻塞问题
（会导致构建失败、线上故障、安全漏洞或明显数据错误；没有则写"无"）

### 重要建议
（影响稳定性、维护性或用户体验，建议合并前处理）

### 一般优化
（非阻塞，但能提升质量的建议）

### 值得肯定
（列出做得好的地方）

### 合并建议
给出明确建议：可以合并 / 修改后合并 / 暂不建议合并，并说明理由。

## PR diff
${truncate(diff, MAX_DIFF_CHARS)}
`;

  const systemPrompt =
    '你是资深代码审查员，擅长发现正确性、安全、稳定性和最佳实践问题。用中文输出结构化 Markdown 审查意见，只输出审查意见，不要修改代码，不要编造 diff 中没有证据的问题。';

  log('调用 AI API 进行代码审查...');
  log(`prompt 长度：约 ${prompt.length} 字符`);

  const content = await callAI({
    prompt,
    systemPrompt,
    maxTokens: 16384,
    tag: TAG,
  });

  log(`审查结果长度：${content.length} 字符`);
  return content;
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

const health = await checkAIHealth(TAG);
if (!health) {
  fail('AI API 预检失败，请检查 AI_API_KEY 和 AI_MODEL 配置');
}

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
