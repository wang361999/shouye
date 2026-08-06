/**
 * 统一 AI 调用模块
 *
 * 模型优先级和配置由后台管理面板控制（系统设置 ai_models_config）。
 * 后台未配置时使用内置默认值。
 *
 * 策略：
 *   1. 按后台配置的优先级顺序依次尝试启用的模型
 *   2. 某个模型失败后自动降级到下一个
 *   3. 所有启用的模型都失败才抛出错误
 */

import prisma from '@/lib/prisma';

// ============ 类型定义 ============

export interface AIModelConfig {
  /** 模型唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 提供商描述 */
  provider: string;
  /** API Key */
  apiKey: string;
  /** API 端点（OpenAI 兼容格式） */
  apiBase: string;
  /** 模型名称 */
  model: string;
  /** 是否启用 */
  enabled: boolean;
  /** 优先级（数字越小越优先，1 = 主力） */
  priority: number;
}

export interface AIModelsConfig {
  /** 模型列表 */
  models: AIModelConfig[];
}

// ============ 内置默认配置 ============

const DEFAULT_MODELS_CONFIG: AIModelsConfig = {
  models: [
    {
      id: 'glm',
      name: 'GLM-5.2',
      provider: '智谱 AI (NVIDIA 平台托管)',
      apiKey: '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',
      apiBase: 'https://integrate.api.nvidia.com/v1/chat/completions',
      model: 'z-ai/glm-5.2',
      enabled: true,
      priority: 1,
    },
    {
      id: 'agnes',
      name: 'Agnes-2.5-flash',
      provider: 'Agnes AI (新加坡 Sapiens AI)',
      apiKey: 'sk-cLl30kp5lGb1p8RUmrQRepLg3YcqUYBHbVk1qk4SrL3UKCNh',
      apiBase: 'https://api.agnes-ai.cn/v1/chat/completions',
      model: 'agnes-2.5-flash',
      enabled: true,
      priority: 2,
    },
    {
      id: 'gemini',
      name: 'Gemini 3.6-flash',
      provider: 'Google',
      apiKey: '',
      apiBase: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      model: 'gemini-3.6-flash',
      enabled: false,
      priority: 3,
    },
  ],
};

// ============ 配置缓存 ============

let cachedConfig: AIModelsConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 30_000; // 30 秒缓存，平衡性能与实时性

/**
 * 从数据库读取 AI 模型配置
 * 如果数据库未配置，返回内置默认值
 */
export async function getAIModelsConfig(): Promise<AIModelsConfig> {
  // 检查缓存
  const now = Date.now();
  if (cachedConfig && now < cacheExpiry) {
    return cachedConfig;
  }

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'ai_models_config' },
    });

    if (setting?.value) {
      const parsed = JSON.parse(setting.value) as AIModelsConfig;
      if (parsed.models && Array.isArray(parsed.models) && parsed.models.length > 0) {
        cachedConfig = parsed;
        cacheExpiry = now + CACHE_TTL;
        return parsed;
      }
    }
  } catch {
    // 数据库不可用时降级使用默认值
  }

  cachedConfig = DEFAULT_MODELS_CONFIG;
  cacheExpiry = now + CACHE_TTL;
  return DEFAULT_MODELS_CONFIG;
}

/**
 * 同步获取缓存的 AI 模型配置（不查询数据库）
 * 如果缓存为空则返回默认值
 */
export function getAIModelsConfigSync(): AIModelsConfig {
  if (cachedConfig) return cachedConfig;
  return DEFAULT_MODELS_CONFIG;
}

/**
 * 清除配置缓存（保存配置后调用）
 */
export function clearAIConfigCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
}

/**
 * 获取默认配置（用于后台初始化）
 */
export function getDefaultAIModelsConfig(): AIModelsConfig {
  return JSON.parse(JSON.stringify(DEFAULT_MODELS_CONFIG));
}

/**
 * 获取按优先级排序的已启用模型列表
 */
export async function getEnabledModels(): Promise<AIModelConfig[]> {
  const config = await getAIModelsConfig();
  return config.models
    .filter((m) => m.enabled && m.apiKey)
    .sort((a, b) => a.priority - b.priority);
}

// ============ 调用选项与结果 ============

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
  provider: string;
  /** 实际使用的模型 ID */
  modelId: string;
}

// ============ 核心 AI 调用函数 ============

/**
 * 调用 AI 补全接口（按后台配置的优先级自动降级）
 *
 * 按优先级依次尝试已启用的模型，某个失败后自动降级到下一个。
 *
 * @param prompt 用户提示词
 * @param options 调用选项
 * @returns AI 返回内容和使用的服务信息
 * @throws 所有启用的模型都失败时抛出错误
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

  // 带 json_mode 降级重试的请求封装
  async function requestWithJsonFallback(
    apiBase: string,
    apiKey: string,
    model: string,
    useJsonMode: boolean,
  ): Promise<string> {
    try {
      return await doRequest(apiBase, apiKey, model, useJsonMode);
    } catch (err) {
      // json_mode 可能不支持，降级为普通模式重试
      if (useJsonMode && err instanceof Error && err.message.includes('response_format')) {
        return await doRequest(apiBase, apiKey, model, false);
      }
      throw err;
    }
  }

  // 获取已启用的模型（按优先级排序）
  const enabledModels = await getEnabledModels();

  if (enabledModels.length === 0) {
    throw new Error('没有可用的 AI 模型，请在后台启用至少一个模型并配置 API Key');
  }

  const errors: string[] = [];

  for (const modelConfig of enabledModels) {
    try {
      const content = await requestWithJsonFallback(
        modelConfig.apiBase,
        modelConfig.apiKey,
        modelConfig.model,
        jsonMode,
      );
      return {
        content: content.trim(),
        provider: modelConfig.name,
        modelId: modelConfig.id,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '失败';
      errors.push(`${modelConfig.name}: ${errMsg}`);
      console.warn(`[AI] ${modelConfig.name} 调用失败，尝试下一个模型:`, errMsg);
    }
  }

  throw new Error(`AI 服务全部不可用。${errors.join('; ')}`);
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
export async function isAIAvailable(): Promise<boolean> {
  const enabled = await getEnabledModels();
  return enabled.length > 0;
}

/**
 * 同步检查（基于缓存）
 */
export function isAIAvailableSync(): boolean {
  const config = getAIModelsConfigSync();
  return config.models.some((m) => m.enabled && m.apiKey);
}
