/**
 * 统一 AI 调用模块
 *
 * 主力：Agnes AI（免费，新加坡 Sapiens AI）
 * 兜底：环境变量配置的 AI 服务（Gemini 等）
 *
 * 策略：
 *   1. 优先调用 Agnes AI，失败时自动降级到兜底服务
 *   2. 兜底服务读取 AI_API_KEY / AI_API_BASE / AI_MODEL 环境变量
 *   3. 两个都失败才抛出错误
 */

/** Agnes AI 配置（主力） */
const AGNES_API_KEY = 'sk-cLl30kp5lGb1p8RUmrQRepLg3YcqUYBHbVk1qk4SrL3UKCNh';
const AGNES_API_BASE = 'https://api.agnes-ai.cn/v1/chat/completions';
const AGNES_MODEL = 'agnes-2.5-flash';

/** 兜底 AI 配置（从环境变量读取，默认 Gemini） */
const FALLBACK_API_KEY = process.env.AI_API_KEY || '';
const FALLBACK_API_BASE =
  process.env.AI_API_BASE ||
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const FALLBACK_MODEL = process.env.AI_MODEL || 'gemini-3.6-flash';

export interface AICallOptions {
  /** 系统提示词 */
  systemPrompt?: string;
  /** 最大输出 token 数 */
  maxTokens?: number;
  /** 温度（0-2），默认 0.7 */
  temperature?: number;
  /** 是否使用 JSON 响应格式 */
  jsonMode?: boolean;
  /** 超时时间（毫秒），默认 120000 */
  timeout?: number;
}

export interface AICallResult {
  /** AI 返回的文本内容 */
  content: string;
  /** 实际使用的服务名称 */
  provider: 'agnes' | 'fallback';
}

/**
 * 调用 AI 补全接口（带兜底）
 *
 * 优先调用 Agnes AI，失败时自动降级到环境变量配置的服务。
 *
 * @param prompt 用户提示词
 * @param options 调用选项
 * @returns AI 返回内容和使用的服务名称
 * @throws 两个服务都失败时抛出错误
 */
export async function callAICompletion(
  prompt: string,
  options: AICallOptions = {},
): Promise<AICallResult> {
  const {
    systemPrompt,
    maxTokens = 4000,
    temperature = 0.7,
    jsonMode = false,
    timeout = 120_000,
  } = options;

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  // 构建请求体
  const buildBody = (model: string, useJsonMode: boolean) => {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };
    if (useJsonMode) {
      body.response_format = { type: 'json_object' };
    }
    return JSON.stringify(body);
  };

  // 单次请求
  async function doRequest(
    apiBase: string,
    apiKey: string,
    model: string,
    useJsonMode: boolean,
  ): Promise<string> {
    const response = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: buildBody(model, useJsonMode),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`API ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI 返回内容为空');
    }
    return content;
  }

  // 1. 尝试 Agnes AI（主力）
  let agnesError: unknown = null;
  try {
    let content: string;
    try {
      content = await doRequest(AGNES_API_BASE, AGNES_API_KEY, AGNES_MODEL, jsonMode);
    } catch (err) {
      // json_mode 可能不支持，降级为普通模式重试
      if (jsonMode && err instanceof Error && err.message.includes('response_format')) {
        content = await doRequest(AGNES_API_BASE, AGNES_API_KEY, AGNES_MODEL, false);
      } else {
        throw err;
      }
    }
    return { content: content.trim(), provider: 'agnes' };
  } catch (err) {
    agnesError = err;
    console.warn('[AI] Agnes AI 调用失败，降级到兜底服务:', err instanceof Error ? err.message : String(err));
  }

  // 2. 降级到兜底服务
  if (!FALLBACK_API_KEY) {
    throw new Error('AI 服务不可用：Agnes AI 失败且未配置兜底 AI_API_KEY');
  }

  try {
    let content: string;
    try {
      content = await doRequest(FALLBACK_API_BASE, FALLBACK_API_KEY, FALLBACK_MODEL, jsonMode);
    } catch (err) {
      if (jsonMode && err instanceof Error && err.message.includes('response_format')) {
        content = await doRequest(FALLBACK_API_BASE, FALLBACK_API_KEY, FALLBACK_MODEL, false);
      } else {
        throw err;
      }
    }
    return { content: content.trim(), provider: 'fallback' };
  } catch (fallbackErr) {
    throw new Error(
      `AI 服务全部不可用。Agnes: ${agnesError instanceof Error ? agnesError.message : '失败'}; 兜底: ${fallbackErr instanceof Error ? fallbackErr.message : '失败'}`,
    );
  }
}

/**
 * 简化版调用（仅返回文本内容）
 *
 * 兼容旧的 callAI 函数签名
 */
export async function callAI(
  prompt: string,
  systemPrompt?: string,
  maxTokens = 4000,
): Promise<string> {
  const result = await callAICompletion(prompt, { systemPrompt, maxTokens });
  return result.content;
}

/**
 * 检查 AI 服务是否可用
 */
export function isAIAvailable(): boolean {
  // Agnes 始终可用（密钥内置），或者兜底服务已配置
  return true;
}
