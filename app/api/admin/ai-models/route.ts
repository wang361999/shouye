import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/auth';
import { logOperation } from '@/lib/admin-log';
import {
  getAIModelsConfig,
  getDefaultAIModelsConfig,
  clearAIConfigCache,
  type AIModelConfig,
  type AIModelsConfig,
} from '@/lib/ai';

// 禁用缓存
export const dynamic = 'force-dynamic';

// ============ GET /api/admin/ai-models - 获取 AI 模型配置 ============
export async function GET(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const config = await getAIModelsConfig();

    // 对 API Key 进行掩码处理，仅返回前8位和后4位
    const maskedModels = config.models.map((m) => ({
      ...m,
      apiKey: maskApiKey(m.apiKey),
      hasApiKey: !!m.apiKey,
    }));

    return NextResponse.json({
      models: maskedModels,
      defaultConfig: getDefaultAIModelsConfig(),
    });
  } catch (error) {
    console.error('[ADMIN AI-MODELS GET ERROR]', error);
    return NextResponse.json(
      { error: '获取 AI 模型配置失败' },
      { status: 500 },
    );
  }
}

// ============ POST /api/admin/ai-models - 保存 AI 模型配置 ============
export async function POST(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    const { models } = body as { models: AIModelConfig[] };

    // ---- 输入校验 ----
    if (!models || !Array.isArray(models) || models.length === 0) {
      return NextResponse.json(
        { error: '模型列表不能为空' },
        { status: 400 },
      );
    }

    // ---- 校验每个模型的字段 ----
    for (const model of models) {
      if (!model.id || !model.name || !model.apiBase || !model.model) {
        return NextResponse.json(
          { error: `模型配置不完整：${model.name || model.id || '未知'} 缺少必填字段` },
          { status: 400 },
        );
      }

      // 优先级必须是正整数
      if (typeof model.priority !== 'number' || model.priority < 1) {
        return NextResponse.json(
          { error: `模型 ${model.name} 的优先级必须是正整数` },
          { status: 400 },
        );
      }
    }

    // ---- 优先级不能重复 ----
    const priorities = models.map((m) => m.priority);
    const uniquePriorities = new Set(priorities);
    if (priorities.length !== uniquePriorities.size) {
      return NextResponse.json(
        { error: '模型优先级不能重复' },
        { status: 400 },
      );
    }

    // ---- 获取当前已存储的配置（用于处理掩码 API Key） ----
    const currentConfig = await getAIModelsConfig();
    const currentKeyMap = new Map(currentConfig.models.map((m) => [m.id, m.apiKey]));

    // ---- 至少需要一个启用的模型 ----
    // apiKey 可能是掩码值（未修改），用 currentKeyMap 判断是否有已存储的 key
    const enabledCount = models.filter((m) => {
      if (!m.enabled) return false;
      // 有新输入的 key，或已存储的 key
      return m.apiKey || currentKeyMap.get(m.id);
    }).length;
    if (enabledCount === 0) {
      return NextResponse.json(
        { error: '至少需要启用一个模型并配置 API Key' },
        { status: 400 },
      );
    }

    // ---- 处理掩码 API Key ----
    // 前端可能返回掩码值 "nvapi-****" 表示未修改，需要从当前配置中取回原值
    const processedModels: AIModelConfig[] = models.map((m) => {
      let apiKey = m.apiKey || '';

      // 如果 apiKey 为掩码值，保留原始 key
      if (isMasked(apiKey)) {
        apiKey = currentKeyMap.get(m.id) || '';
      }

      return {
        id: m.id,
        name: m.name,
        provider: m.provider || '',
        apiKey,
        apiBase: m.apiBase,
        model: m.model,
        enabled: !!m.enabled,
        priority: m.priority,
      };
    });

    const configToSave: AIModelsConfig = { models: processedModels };

    // ---- 保存到数据库 ----
    await prisma.systemSetting.upsert({
      where: { key: 'ai_models_config' },
      update: { value: JSON.stringify(configToSave) },
      create: { key: 'ai_models_config', value: JSON.stringify(configToSave) },
    });

    // ---- 清除缓存 ----
    clearAIConfigCache();

    // ---- 记录操作日志 ----
    const summary = processedModels
      .sort((a, b) => a.priority - b.priority)
      .map((m) => `${m.priority}. ${m.name}(${m.enabled ? '启用' : '禁用'})`)
      .join(', ');
    await logOperation(
      admin.userId,
      admin.username,
      'update_settings',
      'SystemSetting',
      `更新 AI 模型配置: ${summary}`,
    );

    return NextResponse.json({ message: 'AI 模型配置已保存' });
  } catch (error) {
    console.error('[ADMIN AI-MODELS POST ERROR]', error);
    return NextResponse.json(
      { error: '保存 AI 模型配置失败' },
      { status: 500 },
    );
  }
}

// ============ 测试模型连接 ============
export async function PUT(request: NextRequest) {
  try {
    const admin = adminAuth(request);
    if (admin instanceof Response) return admin;

    const body = await request.json();
    let { apiBase, apiKey, model } = body;

    if (!apiBase || !model) {
      return NextResponse.json(
        { error: '缺少测试参数' },
        { status: 400 },
      );
    }

    // 如果前端发送 __use_stored__ 标记，从数据库读取已存储的 key
    if (!apiKey || apiKey === '__use_stored__') {
      const config = await getAIModelsConfig();
      const storedModel = config.models.find(
        (m) => m.apiBase === apiBase && m.model === model,
      );
      if (!storedModel?.apiKey) {
        return NextResponse.json({
          ok: false,
          error: '未找到已存储的 API Key，请先保存配置或手动输入 API Key',
        });
      }
      apiKey = storedModel.apiKey;
    }

    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        error: '缺少 API Key',
      });
    }

    // 发送一个简单的测试请求
    const response = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 64,
        messages: [{ role: 'user', content: '你好，请回复"OK"' }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json({
        ok: false,
        error: `API 返回 ${response.status}: ${text.slice(0, 200)}`,
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    return NextResponse.json({
      ok: true,
      reply: content ? content.slice(0, 100) : '(空响应)',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      ok: false,
      error: msg.includes('timeout') || msg.includes('abort')
        ? '连接超时（30秒）'
        : `连接失败: ${msg}`,
    });
  }
}

// ============ 辅助函数 ============

/** 掩码 API Key，保留前8位和后4位 */
function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 12) return '••••••••';
  return key.slice(0, 8) + '••••••••' + key.slice(-4);
}

/** 判断 API Key 是否为掩码值 */
function isMasked(key: string): boolean {
  return key.includes('••••');
}
