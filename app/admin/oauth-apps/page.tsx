"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

// ============ 类型定义 ============
interface OAuthApp {
  id: string;
  name: string;
  clientId: string;
  clientSecretSet: boolean;
  redirectUris: string[];
  description: string | null;
  homepage: string | null;
  logo: string | null;
  status: string; // active | disabled
  createdAt: string;
  updatedAt: string;
  tokenCount: number;
  authCodeCount: number;
}

// ============ 格式化日期 ============
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mm}-${dd} ${hh}:${mi}`;
}

export default function OAuthAppsPage() {
  const { token } = useAppStore();

  const [apps, setApps] = useState<OAuthApp[]>([]);
  const [loading, setLoading] = useState(true);

  // 创建应用模态框
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    homepage: "",
    logo: "",
  });
  const [redirectUris, setRedirectUris] = useState<string[]>([""]);

  // 创建成功后展示凭证（仅一次）
  const [createdSecret, setCreatedSecret] = useState<{
    clientId: string;
    clientSecret: string;
    name: string;
  } | null>(null);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<OAuthApp | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 状态切换
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ============ 获取列表 ============
  const fetchApps = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch("/api/admin/oauth-apps", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        toast.error("登录已过期，请重新登录");
        return;
      }
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setApps(Array.isArray(data) ? data : []);
    } catch {
      toast.error("获取 OAuth 应用列表失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchApps();
  }, [token, fetchApps]);

  // ============ 复制 ============
  async function handleCopy(text: string, label = "内容") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label}已复制`);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }

  // ============ 动态回调地址 ============
  function addRedirectUri() {
    setRedirectUris((prev) => [...prev, ""]);
  }
  function removeRedirectUri(index: number) {
    setRedirectUris((prev) =>
      prev.length === 1 ? [""] : prev.filter((_, i) => i !== index)
    );
  }
  function updateRedirectUri(index: number, value: string) {
    setRedirectUris((prev) =>
      prev.map((uri, i) => (i === index ? value : uri))
    );
  }

  function openCreateModal() {
    setForm({ name: "", description: "", homepage: "", logo: "" });
    setRedirectUris([""]);
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (submitting) return;
    setCreateOpen(false);
  }

  // ============ 创建应用 ============
  async function handleCreate() {
    if (!token) return;
    const name = form.name.trim();
    if (!name) {
      toast.error("请输入应用名称");
      return;
    }
    const uris = redirectUris.map((u) => u.trim()).filter(Boolean);
    if (uris.length === 0) {
      toast.error("请至少填写一个回调地址");
      return;
    }
    for (const uri of uris) {
      try {
        new URL(uri);
      } catch {
        toast.error(`回调地址格式无效: ${uri}`);
        return;
      }
    }
    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/oauth-apps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          redirectUris: uris,
          description: form.description.trim() || undefined,
          homepage: form.homepage.trim() || undefined,
          logo: form.logo.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "创建失败");
        return;
      }
      toast.success("应用创建成功");
      setCreateOpen(false);
      setCreatedSecret({
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        name,
      });
      fetchApps();
    } catch {
      toast.error("创建失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  // ============ 启用 / 禁用 ============
  async function handleToggleStatus(app: OAuthApp) {
    if (!token) return;
    const newStatus = app.status === "active" ? "disabled" : "active";
    try {
      setTogglingId(app.id);
      const res = await fetch("/api/admin/oauth-apps", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: app.id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "操作失败");
        return;
      }
      toast.success(newStatus === "active" ? "已启用" : "已禁用");
      setApps((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: newStatus } : a))
      );
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setTogglingId(null);
    }
  }

  // ============ 删除应用 ============
  async function handleDelete() {
    if (!token || !deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/oauth-apps?id=${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success("应用已删除");
      setApps((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast.error("删除失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  }

  // ============ 状态标签 ============
  function renderStatus(status: string) {
    if (status === "active") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-200">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          启用
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        禁用
      </span>
    );
  }

  return (
    <AdminLayout activeKey="settings-oauth-apps">
      <div className="space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🔑 OAuth 应用</h1>
            <p className="text-sm text-gray-500 mt-1">
              管理 OAuth 2.0 客户端应用、凭证与回调地址
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            创建应用
          </button>
        </div>

        {/* 列表区域 */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="animate-pulse p-6 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        ) : apps.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">🔑</div>
            <p className="text-gray-500 mb-1">暂无 OAuth 应用</p>
            <p className="text-sm text-gray-400 mb-4">
              创建一个 OAuth 应用以接入第三方授权登录
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              创建第一个应用
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      应用名称
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      Client ID
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      回调地址
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      状态
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      令牌数量
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      创建时间
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {apps.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                      {/* 应用名称 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-medium flex-shrink-0 overflow-hidden">
                            {app.logo ? (
                              <img
                                src={app.logo}
                                alt=""
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              app.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {app.name}
                            </div>
                            {app.description && (
                              <div
                                className="text-xs text-gray-400 truncate max-w-[160px]"
                                title={app.description}
                              >
                                {app.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Client ID */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <code
                            className="text-xs text-gray-600 font-mono max-w-[140px] truncate block"
                            title={app.clientId}
                          >
                            {app.clientId}
                          </code>
                          <button
                            onClick={() => handleCopy(app.clientId, "Client ID")}
                            title="复制 Client ID"
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                      {/* 回调地址 */}
                      <td className="px-4 py-3">
                        <div className="max-w-[220px] space-y-1">
                          {app.redirectUris.map((uri, i) => (
                            <div
                              key={i}
                              className="text-xs text-gray-500 truncate"
                              title={uri}
                            >
                              {uri}
                            </div>
                          ))}
                        </div>
                      </td>
                      {/* 状态 */}
                      <td className="px-4 py-3">{renderStatus(app.status)}</td>
                      {/* 令牌数量 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <span title="访问令牌数量">{app.tokenCount}</span>
                          <span className="text-gray-300">/</span>
                          <span
                            className="text-xs text-gray-400"
                            title="授权码数量"
                          >
                            {app.authCodeCount}
                          </span>
                        </div>
                      </td>
                      {/* 创建时间 */}
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(app.createdAt)}
                      </td>
                      {/* 操作 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleStatus(app)}
                            disabled={togglingId === app.id}
                            title={app.status === "active" ? "禁用应用" : "启用应用"}
                            className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              app.status === "active"
                                ? "text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100"
                                : "text-green-700 bg-green-50 border-green-200 hover:bg-green-100"
                            }`}
                          >
                            {togglingId === app.id
                              ? "处理中..."
                              : app.status === "active"
                              ? "禁用"
                              : "启用"}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(app)}
                            title="删除应用"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ============ 创建应用模态框 ============ */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeCreateModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">创建 OAuth 应用</h3>
              <button
                onClick={closeCreateModal}
                disabled={submitting}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* 表单 */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto">
              {/* 应用名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  应用名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="如：我的博客"
                />
              </div>

              {/* 回调地址（动态） */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    回调地址 <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addRedirectUri}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    添加
                  </button>
                </div>
                <div className="space-y-2">
                  {redirectUris.map((uri, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={uri}
                        onChange={(e) => updateRedirectUri(i, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://example.com/callback"
                      />
                      <button
                        type="button"
                        onClick={() => removeRedirectUri(i)}
                        title="删除该回调地址"
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20 12H4"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  授权完成后将用户重定向到此地址，可配置多个
                </p>
              </div>

              {/* 应用描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  应用描述
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="简要描述应用用途（可选）"
                />
              </div>

              {/* 主页 URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  主页 URL
                </label>
                <input
                  type="text"
                  value={form.homepage}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, homepage: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com（可选）"
                />
              </div>

              {/* Logo URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Logo URL
                </label>
                <input
                  type="text"
                  value={form.logo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, logo: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/logo.png（可选）"
                />
                {form.logo && (
                  <div className="mt-2">
                    <img
                      src={form.logo}
                      alt="Logo 预览"
                      className="h-10 rounded border border-gray-200 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={closeCreateModal}
                disabled={submitting}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "创建中..." : "创建应用"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 创建成功 - 展示凭证（仅一次） ============ */}
      {createdSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            {/* 头部 */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">应用创建成功</h3>
                  <p className="text-xs text-gray-500">{createdSecret.name}</p>
                </div>
              </div>
            </div>

            {/* 内容 */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <svg
                  className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="text-xs text-amber-800">
                  请立即保存以下凭证。
                  <strong>Client Secret 仅在此显示一次</strong>
                  ，关闭后将无法再次查看。
                </p>
              </div>

              {/* Client ID */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Client ID
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 break-all">
                    {createdSecret.clientId}
                  </code>
                  <button
                    onClick={() =>
                      handleCopy(createdSecret.clientId, "Client ID")
                    }
                    className="px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                  >
                    复制
                  </button>
                </div>
              </div>

              {/* Client Secret */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Client Secret
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 break-all">
                    {createdSecret.clientSecret}
                  </code>
                  <button
                    onClick={() =>
                      handleCopy(createdSecret.clientSecret, "Client Secret")
                    }
                    className="px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                  >
                    复制
                  </button>
                </div>
              </div>
            </div>

            {/* 底部 */}
            <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setCreatedSecret(null)}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                我已保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 删除确认模态框 ============ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">确认删除</h3>
            </div>
            <p className="text-gray-500 text-sm mb-1">
              确定要删除 OAuth 应用「
              <span className="font-medium text-gray-700">
                {deleteTarget.name}
              </span>
              」吗？
            </p>
            <p className="text-xs text-red-500 mb-6">
              此操作不可撤销，将同时清除该应用关联的所有授权码与令牌。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
