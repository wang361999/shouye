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

// AI 调用默认超时（30 秒），大 prompt 会自动延长
const AI_TIMEOUT_MS = 30_000;
// AI 调用最大超时（120 秒，用于超大 prompt）
const AI_MAX_TIMEOUT_MS = 120_000;
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
 * 根据prompt长度动态计算超时时间
 * 基础30秒，每1万字符增加10秒，上限120秒
 */
function calcTimeout(promptLength) {
  const base = AI_TIMEOUT_MS;
  const extra = Math.floor(promptLength / 10_000) * 10_000;
  return Math.min(base + extra, AI_MAX_TIMEOUT_MS);
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
            max_tokens: 16,
            messages: [{ role: 'user', content: '你好，请回复"OK"' }],
          }),
        },
        AI_TIMEOUT_MS,
      );

      if (res.ok) {
        const data = await res.json().catch(() => null);
        const content = data?.choices?.[0]?.message?.content;
        console.log(`${tag}   ✅ 模型 ${model} 可用（回复：${(content || '').slice(0, 20)}）`);
        return model;
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

  // 根据prompt长度动态计算超时
  const promptLength = (prompt?.length || 0) + (systemPrompt?.length || 0);
  const timeoutMs = calcTimeout(promptLength);
  if (timeoutMs > AI_TIMEOUT_MS) {
    console.warn(`${tag} prompt 较长（${promptLength} 字符），超时调整为 ${timeoutMs / 1000} 秒`);
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
          const content = data?.choices?.[0]?.message?.content;
          if (content && content.trim()) {
            if (model !== UNIQUE_MODELS[0]) {
              console.warn(`${tag} ⚠️ 主模型不可用，已降级到 ${model}`);
            }
            return content.trim();
          }
          throw new Error('AI 返回内容为空');
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
 * 站点 API fetch 包装：带超时保护
 */
export async function siteFetch(url, options = {}, timeoutMs = SITE_TIMEOUT_MS) {
  return fetchWithTimeout(url, options, timeoutMs);
}

export { AI_TIMEOUT_MS, SITE_TIMEOUT_MS, MAX_RETRIES, RETRY_DELAY_MS };
