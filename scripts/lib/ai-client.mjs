/**
 * 共享 AI 客户端模块
 * 提供超时保护、自动重试、模型降级、预检等能力
 * 所有自动化脚本统一使用此模块调用 AI API
 *
 * 用法：
 *   import { callAI, checkAIHealth } from './lib/ai-client.mjs';
 *
 *   const health = await checkAIHealth();
 *   if (!health) process.exit(1);
 *   const reply = await callAI({ prompt, systemPrompt, maxTokens: 2048 });
 */

const {
  AI_API_KEY = '',
  AI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  AI_MODEL = 'gemini-3.6-flash',
} = process.env;

// AI 调用默认超时（60 秒），大 prompt 或大 maxTokens 会自动延长
const AI_TIMEOUT_MS = 60_000;
// AI 调用最大超时（180 秒，用于超大 prompt + 长文生成）
const AI_MAX_TIMEOUT_MS = 180_000;
// 站点 API 超时（10 秒）
const SITE_TIMEOUT_MS = 10_000;
// 最大重试次数
const MAX_RETRIES = 2;
// 重试间隔
const RETRY_DELAY_MS = 3_000;
// 限流重试间隔（更长）
const RATE_LIMIT_DELAY_MS = 10_000;

// 模型降级链：主模型不可用时自动尝试备用模型
const FALLBACK_MODELS = [
  AI_MODEL,
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];

// 去重，避免主模型和备用模型重复
const UNIQUE_MODELS = [...new Set(FALLBACK_MODELS)];

/**
 * 根据prompt长度和maxTokens动态计算超时时间
 * 基础60秒，每1万字符增加10秒，每4096 maxTokens增加10秒，上限180秒
 */
function calcTimeout(promptLength, maxTokens = 2048) {
  const base = AI_TIMEOUT_MS;
  const promptExtra = Math.floor(promptLength / 10_000) * 10_000;
  const tokenExtra = Math.floor(maxTokens / 4096) * 10_000;
  return Math.min(base + promptExtra + tokenExtra, AI_MAX_TIMEOUT_MS);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch 包装：带超时保护
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = AI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * GitHub Actions 错误标注（在 Actions 日志中以红色高亮显示）
 */
function ghError(message) {
  console.error(`::error::${message}`);
}

function ghWarning(message) {
  console.warn(`::warning::${message}`);
}

/**
 * 预检：测试 AI API 连通性，返回可用的模型名
 * 如果所有模型都不可用，返回 null
 */
export async function checkAIHealth(tag = '[ai-client]') {
  if (!AI_API_KEY) {
    ghError('缺少 AI_API_KEY 环境变量');
    return null;
  }
  if (!AI_API_BASE) {
    ghError('缺少 AI_API_BASE 环境变量');
    return null;
  }

  console.log(`${tag} 预检 AI API（共 ${UNIQUE_MODELS.length} 个候选模型）...`);

  for (const model of UNIQUE_MODELS) {
    try {
      console.log(`${tag}   测试模型：${model} ...`);
      const res = await fetchWithTimeout(
        AI_API_BASE,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: 128,
            messages: [{ role: 'user', content: '你好，请回复"OK"' }],
          }),
        },
        AI_TIMEOUT_MS,
      );

      if (res.ok) {
        const data = await res.json().catch(() => null);
        const content = data?.choices?.[0]?.message?.content;
        if (content && content.trim()) {
          console.log(`${tag}   ✅ 模型 ${model} 可用（回复：${content.trim().slice(0, 20)}）`);
          return model;
        }
        // 200 但内容为空：可能 max_tokens 太小或模型异常，继续尝试下一个
        const rawPreview = JSON.stringify(data)?.slice(0, 300) || '(空响应)';
        console.warn(`${tag}   ⚠️ 模型 ${model} 返回 200 但内容为空，跳过：${rawPreview}`);
        continue;
      }

      const text = await res.text().catch(() => '');
      const preview = text.slice(0, 200).replace(/\n/g, ' ');
      console.warn(`${tag}   ❌ 模型 ${model} 不可用：${res.status} ${preview}`);
    } catch (error) {
      const msg = error?.name === 'AbortError' ? `超时（${AI_TIMEOUT_MS}ms）` : (error?.message || error);
      console.warn(`${tag}   ❌ 模型 ${model} 预检异常：${msg}`);
    }
  }

  ghError('所有 AI 模型均不可用，请检查 AI_API_KEY 和 AI_MODEL 配置');
  return null;
}

/**
 * 调用 AI 生成文本（带超时、重试、模型降级）
 *
 * @param {object} params
 * @param {string} params.prompt - 用户提示词
 * @param {string} [params.systemPrompt] - 系统提示词
 * @param {number} [params.maxTokens=2048] - 最大输出 token 数
 * @param {string} [params.tag='[ai-client]'] - 日志前缀
 * @returns {Promise<string>} AI 生成的文本
 */
export async function callAI({ prompt, systemPrompt, maxTokens = 2048, responseFormat, tag = '[ai-client]' }) {
  let lastError = null;

  // 根据prompt长度和maxTokens动态计算超时
  const promptLength = (prompt?.length || 0) + (systemPrompt?.length || 0);
  const timeoutMs = calcTimeout(promptLength, maxTokens);
  if (timeoutMs > AI_TIMEOUT_MS) {
      console.warn(`${tag} prompt 较长（${promptLength} 字符，maxTokens=${maxTokens}），超时调整为 ${timeoutMs / 1000} 秒`);
    }

  for (const model of UNIQUE_MODELS) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const messages = [];
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const body = {
          model,
          max_tokens: maxTokens,
          messages,
        };
        // response_format 仅在 API 支持时生效，不支持时会被忽略
        if (responseFormat) {
          body.response_format = responseFormat;
        }

        const res = await fetchWithTimeout(
          AI_API_BASE,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${AI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          },
          timeoutMs,
        );

        if (res.ok) {
          const data = await res.json();
          const choice = data?.choices?.[0];
          const content = choice?.message?.content;
          const finishReason = choice?.finish_reason || 'unknown';
          if (content && content.trim()) {
            console.log(`${tag} AI 返回 ${content.length} 字符，finish_reason=${finishReason}，模型=${model}`);
            if (finishReason === 'length') {
              console.warn(`${tag} ⚠️ 响应因 max_tokens 被截断（finish_reason=length），JSON 可能不完整`);
            }
            if (model !== UNIQUE_MODELS[0]) {
              console.warn(`${tag} ⚠️ 主模型不可用，已降级到 ${model}`);
            }
            return content.trim();
          }
          throw new Error(`AI 返回内容为空（finish_reason=${finishReason}）`);
        }

        // 429 限流：等待更长时间后重试
        if (res.status === 429) {
          const text = await res.text().catch(() => '');
          lastError = new Error(`AI API 限流（429）：${text.slice(0, 200)}`);
          if (attempt < MAX_RETRIES) {
            console.warn(`${tag} 模型 ${model} 被限流，等待 ${RATE_LIMIT_DELAY_MS}ms 后重试（${attempt + 1}/${MAX_RETRIES}）...`);
            await sleep(RATE_LIMIT_DELAY_MS);
            continue;
          }
          break; // 尝试下一个模型
        }

        // 404 模型不存在：直接尝试下一个模型
        if (res.status === 404) {
          const text = await res.text().catch(() => '');
          lastError = new Error(`模型 ${model} 不存在（404）：${text.slice(0, 200)}`);
          console.warn(`${tag} 模型 ${model} 不存在，尝试下一个...`);
          break; // 不重试，直接换模型
        }

        // 其他错误：重试
        const text = await res.text().catch(() => '');
        lastError = new Error(`AI API 失败（${res.status}）：${text.slice(0, 300)}`);
        if (attempt < MAX_RETRIES) {
          console.warn(`${tag} 模型 ${model} 调用失败：${res.status}，${RETRY_DELAY_MS}ms 后重试（${attempt + 1}/${MAX_RETRIES}）...`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        break; // 尝试下一个模型
      } catch (error) {
        if (error?.name === 'AbortError') {
          lastError = new Error(`AI API 超时（${timeoutMs}ms）`);
        } else {
          lastError = error;
        }
        if (attempt < MAX_RETRIES) {
          console.warn(`${tag} 模型 ${model} 异常：${lastError.message}，${RETRY_DELAY_MS}ms 后重试（${attempt + 1}/${MAX_RETRIES}）...`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        break;
      }
    }
  }

  // 所有模型都失败
  const errMsg = lastError?.message || '未知错误';
  ghError(`所有 AI 模型调用均失败：${errMsg}`);
  throw lastError || new Error('所有 AI 模型均不可用');
}

/**
 * 健壮 JSON 解析：处理 AI 返回中可能含有的控制字符和截断
 *
 * AI 模型偶尔会在 JSON 字符串值中输出裸换行符、制表符等控制字符，
 * 或因 max_tokens 限制导致输出被截断（JSON 不完整）。
 * 此函数会：
 *   1. 从 ```json ... ``` 代码块中提取 JSON（正确处理嵌套代码块）
 *   2. 定位第一个 { 和最后一个 } 之间的内容
 *   3. 先尝试直接解析
 *   4. 失败则转义所有字符串值中的裸控制字符后重试
 *   5. 仍然失败则尝试自动补全截断的 JSON（补齐引号、括号、大括号）
 *
 * @param {string} text - AI 返回的原始文本
 * @returns {object} 解析后的 JSON 对象
 * @throws {Error} 无法解析时抛出异常
 */
export function robustJSONParse(text) {
  const trimmed = String(text).trim();

  // 提取 ```json ... ``` 代码块
  // 注意：不能使用非贪婪匹配 .*?，因为 JSON 内容字段中可能包含嵌套的 ``` 代码块
  // 正确做法：找到第一个 ``` 和最后一个 ``` 之间的内容
  let candidate = trimmed;
  const firstFence = trimmed.indexOf('```');
  if (firstFence !== -1) {
    const lastFence = trimmed.lastIndexOf('```');
    if (lastFence > firstFence) {
      // 取第一个 ``` 之后到最后一个 ``` 之前的内容
      let inner = trimmed.slice(firstFence + 3, lastFence);
      // 去掉开头的 json 标记
      inner = inner.replace(/^(json|JSON)?\s*/i, '');
      candidate = inner.trim();
    }
  }

  // 找到第一个 { 和最后一个 }
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1) {
    // 没有 {，输出前500字符帮助调试
    console.error('[robustJSONParse] 未找到 JSON 对象边界（缺少 "{"）');
    console.error('[robustJSONParse] AI 返回内容前500字符：', candidate.slice(0, 500));
    throw new Error('未找到 JSON 对象边界（缺少 "{"）');
  }

  // 如果找不到 }，说明 JSON 被截断了，尝试自动补全
  if (end === -1 || end <= start) {
    console.warn('[robustJSONParse] JSON 可能被截断，尝试自动补全...');
    return repairAndParse(candidate.slice(start));
  }

  let jsonStr = candidate.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    // 尝试修复：转义字符串值中的裸控制字符（换行、回车、制表符等）
    jsonStr = escapeControlCharsInStrings(jsonStr);
    try {
      return JSON.parse(jsonStr);
    } catch {
      // 仍然失败，尝试自动补全截断的 JSON
      console.warn('[robustJSONParse] 标准解析失败，尝试自动补全...');
      console.warn('[robustJSONParse] JSON 前200字符：', jsonStr.slice(0, 200));
      return repairAndParse(candidate.slice(start));
    }
  }
}

/**
 * 转义 JSON 字符串值中的裸控制字符
 */
function escapeControlCharsInStrings(jsonStr) {
  return jsonStr.replace(/"(?:\\.|[^"\\])*"/g, (match) => {
    return match.replace(/[\x00-\x1f]/g, (ch) => {
      const code = ch.charCodeAt(0);
      if (code === 10) return '\\n';
      if (code === 13) return '\\r';
      if (code === 9) return '\\t';
      return '\\u' + code.toString(16).padStart(4, '0');
    });
  });
}

/**
 * 尝试修复并解析截断的 JSON
 * 策略：从后往前扫描，补齐未闭合的引号、方括号、大括号
 */
function repairAndParse(jsonStr) {
  // 先转义字符串值中的裸控制字符
  jsonStr = escapeControlCharsInStrings(jsonStr);

  // 统计未闭合的符号
  let inString = false;
  let escape = false;
  const stack = []; // 跟踪 { 和 [

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    if (ch === '}' || ch === ']') stack.pop();
  }

  // 如果在字符串中间被截断，先闭合引号
  let repaired = jsonStr;
  if (inString) {
    repaired += '"';
  }

  // 去掉末尾可能的不完整键值（如 "key": 或 "key": val 不完整）
  // 尝试截掉最后一个不完整的逗号或冒号
  repaired = repaired.replace(/[\s,:]+$/, '');

  // 按入栈顺序的逆序补全
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i] === '{') repaired += '}';
    if (stack[i] === '[') repaired += ']';
  }

  try {
    const result = JSON.parse(repaired);
    console.warn('[robustJSONParse] ✅ 自动补全成功，已解析截断的 JSON');
    return result;
  } catch (err) {
    throw new Error(`JSON 解析失败（含自动补全）：${err.message}`);
  }
}

/**
 * 站点 API fetch 包装：带超时保护
 */
export async function siteFetch(url, options = {}, timeoutMs = SITE_TIMEOUT_MS) {
  return fetchWithTimeout(url, options, timeoutMs);
}

/**
 * 从非 JSON 文本中提取帖子信息（兜底方案）
 * 当 AI 返回的不是有效 JSON 时，尝试从 Markdown/纯文本中提取标题和内容
 *
 * @param {string} text - AI 返回的原始文本
 * @param {string} fallbackTitle - 备选标题
 * @returns {object} 包含 title, content, tags, postType, summary 的对象
 */
export function extractPostFromText(text, fallbackTitle = '') {
  const trimmed = String(text).trim();

  // 尝试从第一行 # 标题 中提取
  let title = fallbackTitle;
  const titleMatch = trimmed.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // 去掉代码块标记，取全部内容作为帖子正文
  let content = trimmed;
  // 如果有标题行，从标题之后开始取内容
  if (titleMatch) {
    const titleIdx = content.indexOf(titleMatch[0]);
    if (titleIdx !== -1) {
      content = content.slice(titleIdx + titleMatch[0].length).trim();
    }
  }

  // 如果内容为空，用原始文本
  if (!content) content = trimmed;

  // 从内容中提取可能的标签
  const tags = [];
  const tagMatches = content.match(/[#＃]([\w\u4e00-\u9fa5]+)/g);
  if (tagMatches) {
    for (const t of tagMatches.slice(0, 3)) {
      tags.push(t.replace(/[#＃]/, ''));
    }
  }

  return {
    title,
    content,
    tags: tags.length > 0 ? tags : ['技术分享'],
    postType: 'discussion',
    summary: content.slice(0, 100).replace(/\n/g, ' '),
  };
}

export { AI_TIMEOUT_MS, SITE_TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS };
