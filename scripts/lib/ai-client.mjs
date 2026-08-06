/**
 * 共享 AI 客户端模块
 * 提供超时保护、自动重试、模型降级、预检等能力
 * 所有自动化脚本统一使用此模块调用 AI API
 *
 * 支持两种配置方式：
 *
 * 1. 多模型配置（推荐）—— 通过 AI_MODELS_CONFIG 环境变量
 *    JSON 数组，每个元素：{ name, apiKey, apiBase, model }
 *    按数组顺序优先级递减，主模型失败自动降级到下一个
 *
 * 2. 单模型配置（向后兼容）—— 通过 AI_API_KEY / AI_API_BASE / AI_MODEL
 *
 * 用法：
 *   import { callAI, checkAIHealth } from './lib/ai-client.mjs';
 *
 *   const health = await checkAIHealth();
 *   if (!health) process.exit(1);
 *   const reply = await callAI({ prompt, systemPrompt, maxTokens: 2048 });
 */

// ============ 超时与重试常量 ============

// AI 调用默认超时（60 秒），大 prompt 或大 maxTokens 会自动延长
const AI_TIMEOUT_MS = 60_000;
// AI 调用最大超时（180 秒，用于超大 prompt + 长文生成）
const AI_MAX_TIMEOUT_MS = 180_000;
// 站点 API 超时（10 秒）
const SITE_TIMEOUT_MS = 10_000;
// 最大重试次数（每个模型）
const MAX_RETRIES = 2;
// 重试间隔
const RETRY_DELAY_MS = 3_000;
// 限流重试间隔（更长）
const RATE_LIMIT_DELAY_MS = 10_000;

// ============ 模型配置解析 ============

/**
 * 从环境变量解析模型配置列表
 *
 * 优先读取 AI_MODELS_CONFIG（JSON 数组），支持多提供商、多端点。
 * 回退到 AI_API_KEY / AI_API_BASE / AI_MODEL 单模型配置。
 *
 * @returns {Array<{name:string, apiKey:string, apiBase:string, model:string}>}
 */
function parseModelConfigs() {
  // 1. 尝试 AI_MODELS_CONFIG（多模型）
  const raw = process.env.AI_MODELS_CONFIG;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed
          .filter((m) => m && m.apiKey && m.apiBase && m.model)
          .map((m, i) => ({
            name: m.name || m.model,
            apiKey: String(m.apiKey),
            apiBase: String(m.apiBase),
            model: String(m.model),
            priority: i,
          }));
        if (valid.length > 0) return valid;
        console.warn('[ai-client] AI_MODELS_CONFIG 解析后无有效模型，回退到单模型配置');
      }
    } catch (e) {
      console.warn(`[ai-client] AI_MODELS_CONFIG 解析失败：${e.message}，回退到单模型配置`);
    }
  }

  // 2. 回退到单模型配置
  const {
    AI_API_KEY = '',
    AI_API_BASE = '',
    AI_MODEL = '',
  } = process.env;

  if (AI_API_KEY && AI_API_BASE && AI_MODEL) {
    return [{
      name: AI_MODEL,
      apiKey: AI_API_KEY,
      apiBase: AI_API_BASE,
      model: AI_MODEL,
      priority: 0,
    }];
  }

  return [];
}

// 启动时解析一次
const MODEL_CONFIGS = parseModelConfigs();

// ============ 工具函数 ============

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 根据 prompt 长度和 maxTokens 动态计算超时时间
 * 基础 60 秒，每 1 万字符增加 10 秒，每 4096 maxTokens 增加 10 秒，上限 180 秒
 */
function calcTimeout(promptLength, maxTokens = 2048) {
  const base = AI_TIMEOUT_MS;
  const promptExtra = Math.floor(promptLength / 10_000) * 10_000;
  const tokenExtra = Math.floor(maxTokens / 4096) * 10_000;
  return Math.min(base + promptExtra + tokenExtra, AI_MAX_TIMEOUT_MS);
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

// ============ 预检函数 ============

/**
 * 预检：测试所有配置模型的连通性，返回第一个可用模型的信息
 * 如果所有模型都不可用，返回 null
 *
 * @param {string} [tag='[ai-client]'] - 日志前缀
 * @returns {Promise<{name:string, model:string}|null>}
 */
export async function checkAIHealth(tag = '[ai-client]') {
  if (MODEL_CONFIGS.length === 0) {
    ghError('未配置任何 AI 模型（AI_MODELS_CONFIG 或 AI_API_KEY/AI_API_BASE/AI_MODEL）');
    return null;
  }

  console.log(`${tag} 预检 AI API（共 ${MODEL_CONFIGS.length} 个模型）...`);

  for (const cfg of MODEL_CONFIGS) {
    try {
      console.log(`${tag}   测试模型：${cfg.name} (${cfg.model}) ...`);
      const res = await fetchWithTimeout(
        cfg.apiBase,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: cfg.model,
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
          console.log(`${tag}   ✅ 模型 ${cfg.name} 可用（回复：${content.trim().slice(0, 20)}）`);
          return { name: cfg.name, model: cfg.model };
        }
        const rawPreview = JSON.stringify(data)?.slice(0, 300) || '(空响应)';
        console.warn(`${tag}   ⚠️ 模型 ${cfg.name} 返回 200 但内容为空，跳过：${rawPreview}`);
        continue;
      }

      const text = await res.text().catch(() => '');
      const preview = text.slice(0, 200).replace(/\n/g, ' ');
      console.warn(`${tag}   ❌ 模型 ${cfg.name} 不可用：${res.status} ${preview}`);
    } catch (error) {
      const msg = error?.name === 'AbortError' ? `超时（${AI_TIMEOUT_MS}ms）` : (error?.message || error);
      console.warn(`${tag}   ❌ 模型 ${cfg.name} 预检异常：${msg}`);
    }
  }

  ghError('所有 AI 模型均不可用，请检查模型配置');
  return null;
}

// ============ 核心 AI 调用 ============

/**
 * 调用 AI 生成文本（带超时、重试、模型降级）
 *
 * 按配置顺序依次尝试每个模型，每个模型最多重试 MAX_RETRIES 次。
 * 某个模型全部失败后自动降级到下一个模型。
 *
 * @param {object} params
 * @param {string} params.prompt - 用户提示词
 * @param {string} [params.systemPrompt] - 系统提示词
 * @param {number} [params.maxTokens=2048] - 最大输出 token 数
 * @param {object} [params.responseFormat] - 响应格式（如 { type: 'json_object' }）
 * @param {string} [params.tag='[ai-client]'] - 日志前缀
 * @returns {Promise<string>} AI 生成的文本
 * @throws {Error} 所有模型都失败时抛出
 */
export async function callAI({ prompt, systemPrompt, maxTokens = 2048, responseFormat, tag = '[ai-client]' }) {
  if (MODEL_CONFIGS.length === 0) {
    throw new Error('未配置任何 AI 模型（请设置 AI_MODELS_CONFIG 或 AI_API_KEY/AI_API_BASE/AI_MODEL）');
  }

  let lastError = null;

  // 根据 prompt 长度和 maxTokens 动态计算超时
  const promptLength = (prompt?.length || 0) + (systemPrompt?.length || 0);
  const timeoutMs = calcTimeout(promptLength, maxTokens);
  if (timeoutMs > AI_TIMEOUT_MS) {
    console.warn(`${tag} prompt 较长（${promptLength} 字符，maxTokens=${maxTokens}），超时调整为 ${timeoutMs / 1000} 秒`);
  }

  for (const cfg of MODEL_CONFIGS) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const messages = [];
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const body = {
          model: cfg.model,
          max_tokens: maxTokens,
          messages,
        };
        // response_format 仅在 API 支持时生效，不支持时会被忽略
        if (responseFormat) {
          body.response_format = responseFormat;
        }

        const res = await fetchWithTimeout(
          cfg.apiBase,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cfg.apiKey}`,
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
            console.log(`${tag} AI 返回 ${content.length} 字符，finish_reason=${finishReason}，模型=${cfg.name}`);
            if (finishReason === 'length') {
              console.warn(`${tag} ⚠️ 响应因 max_tokens 被截断（finish_reason=length），JSON 可能不完整`);
            }
            if (cfg !== MODEL_CONFIGS[0]) {
              console.warn(`${tag} ⚠️ 主模型不可用，已降级到 ${cfg.name}`);
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
            console.warn(`${tag} 模型 ${cfg.name} 被限流，等待 ${RATE_LIMIT_DELAY_MS}ms 后重试（${attempt + 1}/${MAX_RETRIES}）...`);
            await sleep(RATE_LIMIT_DELAY_MS);
            continue;
          }
          break; // 尝试下一个模型
        }

        // 404 模型不存在：直接尝试下一个模型
        if (res.status === 404) {
          const text = await res.text().catch(() => '');
          lastError = new Error(`模型 ${cfg.name} 不存在（404）：${text.slice(0, 200)}`);
          console.warn(`${tag} 模型 ${cfg.name} 不存在，尝试下一个...`);
          break; // 不重试，直接换模型
        }

        // 其他错误：重试
        const text = await res.text().catch(() => '');
        lastError = new Error(`AI API 失败（${res.status}）：${text.slice(0, 300)}`);
        if (attempt < MAX_RETRIES) {
          console.warn(`${tag} 模型 ${cfg.name} 调用失败：${res.status}，${RETRY_DELAY_MS}ms 后重试（${attempt + 1}/${MAX_RETRIES}）...`);
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
          console.warn(`${tag} 模型 ${cfg.name} 异常：${lastError.message}，${RETRY_DELAY_MS}ms 后重试（${attempt + 1}/${MAX_RETRIES}）...`);
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

// ============ JSON 解析工具 ============

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

  // 策略1：直接从原始文本中提取 JSON（优先尝试）
  const result = tryParseJSON(trimmed);
  if (result) return result;

  // 策略2：从 ```json ... ``` 代码块中提取
  if (trimmed.startsWith('```')) {
    const lastFence = trimmed.lastIndexOf('```');
    const firstFence = trimmed.indexOf('```');
    if (lastFence > firstFence) {
      let inner = trimmed.slice(firstFence + 3, lastFence);
      inner = inner.replace(/^(json|JSON)?\s*/i, '').trim();
      const fencedResult = tryParseJSON(inner);
      if (fencedResult) return fencedResult;
    }
  }

  // 所有策略都失败
  console.error('[robustJSONParse] 所有解析策略均失败');
  console.error('[robustJSONParse] AI 返回内容前500字符：', trimmed.slice(0, 500));
  throw new Error('JSON 解析失败：无法从 AI 返回内容中提取有效 JSON');
}

/**
 * 尝试从文本中提取并解析 JSON 对象
 * @returns {object|null} 解析成功返回对象，失败返回 null
 */
function tryParseJSON(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;

  const end = text.lastIndexOf('}');
  if (end === -1 || end <= start) {
    console.warn('[robustJSONParse] JSON 可能被截断，尝试自动补全...');
    try {
      return repairAndParse(text.slice(start));
    } catch {
      return null;
    }
  }

  let jsonStr = text.slice(start, end + 1);

  // 尝试1：直接解析
  try {
    return JSON.parse(jsonStr);
  } catch {
    // 继续
  }

  // 尝试2：转义字符串值中的裸控制字符后重试
  jsonStr = escapeControlCharsInStrings(jsonStr);
  try {
    return JSON.parse(jsonStr);
  } catch {
    // 继续
  }

  // 尝试3：自动补全截断的 JSON
  console.warn('[robustJSONParse] 标准解析失败，尝试自动补全...');
  console.warn('[robustJSONParse] JSON 前200字符：', jsonStr.slice(0, 200));
  try {
    return repairAndParse(text.slice(start));
  } catch {
    return null;
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
 */
function repairAndParse(jsonStr) {
  jsonStr = escapeControlCharsInStrings(jsonStr);

  let inString = false;
  let escape = false;
  const stack = [];

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    if (ch === '}' || ch === ']') stack.pop();
  }

  let repaired = jsonStr;
  if (inString) {
    repaired += '"';
  }

  repaired = repaired.replace(/[\s,:]+$/, '');

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

// ============ 站点 API 工具 ============

/**
 * 站点 API fetch 包装：带超时保护
 */
export async function siteFetch(url, options = {}, timeoutMs = SITE_TIMEOUT_MS) {
  return fetchWithTimeout(url, options, timeoutMs);
}

/**
 * 从非 JSON 文本中提取帖子信息（兜底方案）
 *
 * @param {string} text - AI 返回的原始文本
 * @param {string} fallbackTitle - 备选标题
 * @returns {object} 包含 title, content, tags, postType, summary 的对象
 */
export function extractPostFromText(text, fallbackTitle = '') {
  const trimmed = String(text).trim();

  let title = fallbackTitle;
  const titleMatch = trimmed.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  let content = trimmed;
  if (titleMatch) {
    const titleIdx = content.indexOf(titleMatch[0]);
    if (titleIdx !== -1) {
      content = content.slice(titleIdx + titleMatch[0].length).trim();
    }
  }

  if (!content) content = trimmed;

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

export { AI_TIMEOUT_MS, SITE_TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS, MODEL_CONFIGS };
