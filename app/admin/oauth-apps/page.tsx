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
                              // eslint-disable-next-line @next/next/no-img-element
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
                      <td className="px-4 py-3 text-gray-500">
                        <div className="space-y-0.5">
                          <div>Tokens: {app.tokenCount}</div>
                          <div className="text-xs text-gray-400">Codes: {app.authCodeCount}</div>
                        </div>
                      </td>
                      {/* 创建时间 */}
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(app.createdAt)}
                      </td>
                      {/* 操作 */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(app)}
                            disabled={togglingId === app.id}
                            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                              app.status === "active"
                                ? "text-amber-600 hover:bg-amber-50"
                                : "text-green-600 hover:bg-green-50"
                            }`}
                          >
                            {app.status === "active" ? "禁用" : "启用"}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(app)}
                            className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            删除
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

      {/* 创建模态框 */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">创建 OAuth 应用</h2>
              <button onClick={closeCreateModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">应用名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如: ET-Studio Portal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">应用描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="描述您的应用"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">主页 URL</label>
                <input
                  type="text"
                  value={form.homepage}
                  onChange={(e) => setForm({ ...form, homepage: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input
                  type="text"
                  value={form.logo}
                  onChange={(e) => setForm({ ...form, logo: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">回调地址 (Redirect URIs) *</label>
                  <button type="button" onClick={addRedirectUri} className="text-xs text-blue-600 hover:underline">
                    + 添加
                  </button>
                </div>
                <div className="space-y-2">
                  {redirectUris.map((uri, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={uri}
                        onChange={(e) => updateRedirectUri(index, e.target.value)}
                        placeholder="https://example.com/api/auth/callback"
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeRedirectUri(index)}
                        className="p-1.5 text-gray-400 hover:text-red-500 border border-gray-300 rounded-lg hover:bg-gray-55"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? "创建中..." : "确定创建"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创建成功凭据展示 */}
      {createdSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-green-50 border-b border-green-100 text-green-800 font-bold flex items-center gap-2">
              <span>🎉</span>
              <span>应用创建成功</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                请务必复制并妥善保存以下凭据。<strong>Client Secret 仅在此处显示一次，关闭后将无法再次获取！</strong>
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">应用名称</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800">
                    {createdSecret.name}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-500">Client ID</label>
                    <button
                      onClick={() => handleCopy(createdSecret.clientId, "Client ID")}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      复制
                    </button>
                  </div>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-800 break-all select-all">
                    {createdSecret.clientId}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-500">Client Secret</label>
                    <button
                      onClick={() => handleCopy(createdSecret.clientSecret, "Client Secret")}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      复制
                    </button>
                  </div>
                  <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm font-mono text-red-800 break-all select-all font-semibold">
                    {createdSecret.clientSecret}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setCreatedSecret(null)}
                className="px-4 py-2 bg-gray-950 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                我已经保存，关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认模态框 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-xl">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xl mx-auto mb-3">
                ⚠️
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">确认删除应用？</h3>
              <p className="text-sm text-gray-500">
                确定要删除 OAuth 应用 <strong className="text-gray-800">“{deleteTarget.name}”</strong> 吗？
                删除后，所有已颁发的 Access Token 和 Authorization Code 将立即失效，可能导致接入该应用的第三方用户无法登录。此操作不可撤销。
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 rounded-b-xl">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                {deleting ? "正在删除..." : "确定删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
