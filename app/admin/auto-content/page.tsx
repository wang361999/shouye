"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import toast from "react-hot-toast";

interface TriggerLog {
  id: string;
  username: string;
  detail: string;
  createdAt: string;
}

interface StatusData {
  configured: boolean;
  repo: string;
  workflow: string;
  lastTriggers: TriggerLog[];
}

export default function AutoContentPage() {
  const { token, _hydrated, hydrate } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [status, setStatus] = useState<StatusData | null>(null);

  // 初始化登录状态
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 获取工作流状态
  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await adminFetch("/api/admin/auto-content-creator", {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error("加载配置状态失败");
      }
      const data = await res.json();
      setStatus(data);
    } catch (err: any) {
      toast.error(err.name === "AbortError" ? "加载超时，请刷新重试" : "获取 AI 自动写博配置失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchStatus();
    }
  }, [token, fetchStatus]);

  // 触发写博工作流
  const handleTrigger = async () => {
    if (!token) return;
    try {
      setTriggering(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await adminFetch("/api/admin/auto-content-creator", {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "触发失败");
        return;
      }

      toast.success(data.message, { duration: 5000 });
      // 重新获取最新的触发日志
      fetchStatus();
    } catch (err: any) {
      toast.error(err.name === "AbortError" ? "请求超时，请检查 GitHub 访问是否通畅" : "触发任务失败，请稍后重试");
    } finally {
      setTriggering(false);
    }
  };

  if (!_hydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="ml-3 text-sm text-gray-500">正在进行水合认证...</span>
      </div>
    );
  }

  return (
    <AdminLayout activeKey="settings-auto-content">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 页头 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            🤖 AI 自动内容创作终端
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            利用 AI 全自动创作技术博客，并将其自动发布至论坛社区。
          </p>
        </div>

        {/* 主控面板 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              ⚡ 即时触发写博任务
            </h2>
            
            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-12 bg-gray-100 rounded-lg w-full" />
                <div className="h-4 bg-gray-100 rounded w-2/3" />
              </div>
            ) : status ? (
              <div className="space-y-6">
                {/* 状态指示 */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-100 text-blue-800">
                  <span className="text-xl">ℹ️</span>
                  <div className="text-sm">
                    <p className="font-medium">关联 GitHub 自动化工作流</p>
                    <p className="mt-1 text-blue-700">
                      目标仓库: <span className="font-mono bg-blue-100/50 px-1 py-0.5 rounded">{status.repo}</span>
                    </p>
                    <p className="text-blue-700">
                      Workflow 文件: <span className="font-mono bg-blue-100/50 px-1 py-0.5 rounded">{status.workflow}</span>
                    </p>
                  </div>
                </div>

                {/* 凭证诊断 */}
                {!status.configured && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-100 text-amber-800">
                    <span className="text-xl">⚠️</span>
                    <div className="text-sm">
                      <p className="font-medium">GitHub Token 未配置</p>
                      <p className="mt-1 text-amber-700">
                        需要配置 GitHub Token 以触发工作流。请确保：
                      </p>
                      <ul className="list-disc pl-5 mt-1 space-y-1 text-amber-700">
                        <li>已在环境变量中设置 <code className="font-mono">GITHUB_TOKEN</code></li>
                        <li>或者在系统安全设置中保存了 GitHub Token。</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* 操作按钮区 */}
                <div className="flex items-center gap-4 pt-2">
                  <button
                    onClick={handleTrigger}
                    disabled={triggering || !status.configured}
                    className={`inline-flex items-center gap-2 px-6 py-3 font-semibold text-white rounded-lg shadow transition-colors ${
                      triggering || !status.configured
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    }`}
                  >
                    {triggering ? (
                      <>
                        <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        正在下发触发指令...
                      </>
                    ) : (
                      <>
                        🚀 触发 AI 自动写博客
                      </>
                    )}
                  </button>
                  
                  {status.configured && (
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-ping" />
                      运行环境就绪
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                暂无状态，请确保您拥有管理员权限
              </div>
            )}
          </div>
        </div>

        {/* 触发历史 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              📜 历史触发日志
            </h3>
            <button
              onClick={fetchStatus}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              🔄 刷新日志
            </button>
          </div>
          
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="p-6 space-y-3">
                <div className="h-4 bg-gray-50 rounded animate-pulse" />
                <div className="h-4 bg-gray-50 rounded animate-pulse w-5/6" />
              </div>
            ) : status?.lastTriggers && status.lastTriggers.length > 0 ? (
              status.lastTriggers.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{log.detail}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      触发人: <span className="text-gray-600">{log.username}</span>
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    {new Date(log.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-gray-400">
                暂无历史触发日志，快去点击触发吧！
              </div>
            )}
          </div>
        </div>

        {/* 流程指南 */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 space-y-4">
          <h4 className="font-semibold text-gray-900 flex items-center gap-1.5">
            📖 任务执行说明
          </h4>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600">
            <li>
              点击触发按钮后，系统将通过 GitHub API 向对应的仓库发出事件，唤醒名为 <code className="bg-gray-100 px-1 rounded font-mono">auto-content-creator.yml</code> 的 GitHub Action。
            </li>
            <li>
              GitHub Action 将执行 <code className="bg-gray-100 px-1 rounded font-mono">scripts/auto-content-creator.mjs</code>，连接您的 AI API 并自动挑选热点技术主题开始撰写。
            </li>
            <li>
              AI 撰写完成后，会自动调用论坛的发帖接口，发布一篇具有极高阅读价值的高质量技术博客。
            </li>
            <li>
              整个流程完全在后台异步安全运行，您只需点击一次即可完美解放双手！
            </li>
          </ol>
        </div>
      </div>
    </AdminLayout>
  );
}
