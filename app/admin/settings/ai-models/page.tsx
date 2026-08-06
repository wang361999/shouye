"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import toast from "react-hot-toast";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  FormField,
  Switch,
  Spinner,
  Icons,
} from "@/components/admin/ui";

// ============ 类型定义 ============
interface AIModelConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  apiBase: string;
  model: string;
  enabled: boolean;
  priority: number;
  hasApiKey?: boolean;
}

export default function AIModelsSettingsPage() {
  const { token } = useAppStore();
  const [models, setModels] = useState<AIModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // ============ 加载配置 ============
  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminFetch("/api/admin/ai-models");
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setModels(data.models || []);
    } catch {
      toast.error("获取 AI 模型配置失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchConfig();
  }, [token, fetchConfig]);

  // ============ 保存配置 ============
  async function handleSave() {
    // 校验：至少一个启用的模型有 API Key
    const validEnabled = models.filter((m) => m.enabled && (m.apiKey || m.hasApiKey));
    if (validEnabled.length === 0) {
      toast.error("至少需要启用一个模型并配置 API Key");
      return;
    }

    // 校验优先级不重复
    const priorities = models.map((m) => m.priority);
    if (new Set(priorities).size !== priorities.length) {
      toast.error("模型优先级不能重复");
      return;
    }

    try {
      setSaving(true);
      const res = await adminFetch("/api/admin/ai-models", {
        method: "POST",
        body: JSON.stringify({ models }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "保存失败");
        return;
      }
      toast.success("AI 模型配置已保存");
      // 重新加载以获取掩码后的 key
      fetchConfig();
    } catch {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  // ============ 测试连接 ============
  async function handleTest(model: AIModelConfig) {
    // 先检查是否有 API Key
    const apiKey = model.apiKey || (model.hasApiKey ? "use-stored" : "");
    if (!apiKey) {
      toast.error(`请先配置 ${model.name} 的 API Key`);
      return;
    }

    setTestingId(model.id);
    try {
      // 如果是掩码值，发送特殊标记让后端使用已存储的 key
      const testApiKey = model.hasApiKey && (!model.apiKey || model.apiKey.includes("••••"))
        ? "__use_stored__"
        : model.apiKey;

      const res = await adminFetch("/api/admin/ai-models", {
        method: "PUT",
        body: JSON.stringify({
          apiBase: model.apiBase,
          apiKey: testApiKey,
          model: model.model,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`${model.name} 连接成功！回复：${data.reply || "OK"}`);
      } else {
        toast.error(`${model.name} 连接失败：${data.error || "未知错误"}`);
      }
    } catch {
      toast.error(`${model.name} 测试请求失败`);
    } finally {
      setTestingId(null);
    }
  }

  // ============ 更新模型字段 ============
  function updateModel(id: string, field: keyof AIModelConfig, value: string | boolean | number) {
    setModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  }

  // ============ 调整优先级（上移/下移） ============
  function moveUp(index: number) {
    if (index === 0) return;
    setModels((prev) => {
      const arr = [...prev];
      // 交换 priority 值
      const tmp = arr[index].priority;
      arr[index].priority = arr[index - 1].priority;
      arr[index - 1].priority = tmp;
      // 重新排序
      arr.sort((a, b) => a.priority - b.priority);
      return arr;
    });
  }

  function moveDown(index: number) {
    if (index === models.length - 1) return;
    setModels((prev) => {
      const arr = [...prev];
      const tmp = arr[index].priority;
      arr[index].priority = arr[index + 1].priority;
      arr[index + 1].priority = tmp;
      arr.sort((a, b) => a.priority - b.priority);
      return arr;
    });
  }

  // ============ 重置为默认 ============
  async function handleReset() {
    if (!confirm("确定要重置为默认配置吗？这将清除所有自定义设置。")) return;
    try {
      setLoading(true);
      // 获取默认配置
      const res = await adminFetch("/api/admin/ai-models");
      const data = await res.json();
      const defaultModels = data.defaultConfig?.models || [];
      // 保存默认配置
      await adminFetch("/api/admin/ai-models", {
        method: "POST",
        body: JSON.stringify({ models: defaultModels }),
      });
      toast.success("已重置为默认配置");
      fetchConfig();
    } catch {
      toast.error("重置失败");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout activeKey="settings-ai-models">
        <div className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeKey="settings-ai-models">
      <div className="space-y-6">
        <PageHeader
          title="AI 模型配置"
          subtitle="配置 AI 大模型的优先级、API Key 和启用状态"
        />

        {/* 说明卡片 */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-medium">模型优先级说明</p>
              <p>系统会按优先级从高到低（数字从小到大）依次尝试调用 AI 模型。主力模型调用失败时，会自动降级到下一个模型。</p>
              <p>使用↑↓按钮调整优先级顺序。至少需要启用一个模型并配置 API Key。</p>
            </div>
          </div>
        </div>

        {/* 模型列表 */}
        <div className="space-y-4">
          {models.map((model, index) => (
            <Card key={model.id}>
              <CardHeader
                title={model.name}
                subtitle={model.provider}
                action={
                  <div className="flex items-center gap-3">
                    {/* 优先级徽章 */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                      model.priority === 1
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : model.priority === 2
                        ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                        : "bg-gray-50 text-gray-500 border border-gray-200"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        model.priority === 1 ? "bg-green-500"
                        : model.priority === 2 ? "bg-yellow-500"
                        : "bg-gray-400"
                      }`} />
                      {model.priority === 1 ? "主力" : model.priority === 2 ? "一级兜底" : "二级兜底"}
                    </span>

                    {/* 优先级调整按钮 */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="上移（提高优先级）"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveDown(index)}
                        disabled={index === models.length - 1}
                        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="下移（降低优先级）"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    </div>

                    {/* 启用/禁用开关 */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {model.enabled ? "已启用" : "已禁用"}
                      </span>
                      <Switch
                        checked={model.enabled}
                        onChange={(v) => updateModel(model.id, "enabled", v)}
                      />
                    </div>
                  </div>
                }
              />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="模型名称" hint="显示用的名称">
                    <Input
                      value={model.name}
                      onChange={(e) => updateModel(model.id, "name", e.target.value)}
                      placeholder="如：GLM-5.2"
                    />
                  </FormField>
                  <FormField label="提供商描述" hint="模型提供方">
                    <Input
                      value={model.provider}
                      onChange={(e) => updateModel(model.id, "provider", e.target.value)}
                      placeholder="如：智谱 AI"
                    />
                  </FormField>
                </div>

                <FormField label="API 端点" hint="OpenAI 兼容格式的 chat completions 接口地址">
                  <Input
                    value={model.apiBase}
                    onChange={(e) => updateModel(model.id, "apiBase", e.target.value)}
                    placeholder="https://api.example.com/v1/chat/completions"
                    className="font-mono text-sm"
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="模型标识" hint="API 请求中 model 参数的值">
                    <Input
                      value={model.model}
                      onChange={(e) => updateModel(model.id, "model", e.target.value)}
                      placeholder="如：z-ai/glm-5.2"
                      className="font-mono text-sm"
                    />
                  </FormField>
                  <FormField label="API Key" hint={model.hasApiKey ? "已配置，输入新值可修改" : "请输入 API Key"}>
                    <Input
                      type="password"
                      value={model.apiKey}
                      onChange={(e) => updateModel(model.id, "apiKey", e.target.value)}
                      placeholder={model.hasApiKey ? "已配置（输入新值可修改）" : "请输入 API Key"}
                      className="font-mono text-sm"
                    />
                  </FormField>
                </div>

                {/* 测试连接按钮 */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTest(model)}
                    loading={testingId === model.id}
                    disabled={!model.enabled && !model.apiKey}
                  >
                    <Icons.Search className="w-4 h-4" />
                    测试连接
                  </Button>
                  {model.hasApiKey && !model.apiKey && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      API Key 已配置
                    </span>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* 底部操作栏 */}
        <div className="flex justify-between items-center">
          <Button
            variant="secondary"
            onClick={handleReset}
            disabled={saving}
          >
            重置为默认
          </Button>
          <Button onClick={handleSave} loading={saving}>
            <Icons.Check className="w-4 h-4" />
            保存配置
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
