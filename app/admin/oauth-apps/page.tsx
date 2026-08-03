"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import toast from "react-hot-toast";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  StatusBadge,
  Modal,
  ConfirmDialog,
  DataTable,
  IconButton,
  Input,
  Textarea,
  FormField,
  copyToClipboard,
  Icons,
  TableLoading,
  EmptyState,
} from "@/components/admin/ui";
import { formatDateTime } from "@/lib/admin-utils";

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

// ============ 状态映射 ============
const STATUS_MAP: Record<
  string,
  { label: string; color: "gray" | "blue" | "green" | "yellow" | "red" | "purple" | "indigo" }
> = {
  active: { label: "启用", color: "green" },
  disabled: { label: "禁用", color: "gray" },
};

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
      const res = await adminFetch("/api/admin/oauth-apps");
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

  // ============ 复制（使用共享 copyToClipboard） ============
  async function handleCopy(text: string, label = "内容") {
    const ok = await copyToClipboard(text);
    if (ok) {
      toast.success(`${label}已复制`);
    } else {
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
      const res = await adminFetch("/api/admin/oauth-apps", {
        method: "POST",
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
      const res = await adminFetch("/api/admin/oauth-apps", {
        method: "PATCH",
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
      const res = await adminFetch(`/api/admin/oauth-apps?id=${deleteTarget.id}`, {
        method: "DELETE",
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

  return (
    <AdminLayout activeKey="settings-oauth-apps">
      <div className="space-y-6">
        {/* 页头 */}
        <PageHeader
          title="OAuth 应用"
          subtitle="管理 OAuth 2.0 客户端应用、凭证与回调地址"
          actions={
            <Button onClick={openCreateModal}>
              <Icons.Plus className="w-4 h-4" />
              创建应用
            </Button>
          }
        />

        {/* 列表区域 */}
        {loading ? (
          <Card>
            <TableLoading cols={7} rows={4} />
          </Card>
        ) : apps.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icons.Key className="w-12 h-12" />}
              title="暂无 OAuth 应用"
              description="创建一个 OAuth 应用以接入第三方授权登录"
              action={
                <Button onClick={openCreateModal}>
                  <Icons.Plus className="w-4 h-4" />
                  创建第一个应用
                </Button>
              }
            />
          </Card>
        ) : (
          <Card>
            <DataTable
              headers={[
                "应用名称",
                "Client ID",
                "回调地址",
                "状态",
                "令牌数量",
                "创建时间",
                "操作",
              ]}
            >
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
                      <IconButton
                        icon={<Icons.Copy className="w-3.5 h-3.5" />}
                        onClick={() => handleCopy(app.clientId, "Client ID")}
                        title="复制 Client ID"
                      />
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
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} map={STATUS_MAP} />
                  </td>
                  {/* 令牌数量 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge color="blue">{app.tokenCount}</Badge>
                      <span className="text-gray-300">/</span>
                      <Badge color="gray">{app.authCodeCount}</Badge>
                    </div>
                  </td>
                  {/* 创建时间 */}
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDateTime(app.createdAt)}
                  </td>
                  {/* 操作 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant={app.status === "active" ? "secondary" : "primary"}
                        size="sm"
                        onClick={() => handleToggleStatus(app)}
                        loading={togglingId === app.id}
                      >
                        {app.status === "active" ? "禁用" : "启用"}
                      </Button>
                      <IconButton
                        icon={<Icons.Trash className="w-4 h-4" />}
                        onClick={() => setDeleteTarget(app)}
                        title="删除应用"
                        variant="danger"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </Card>
        )}
      </div>

      {/* ============ 创建应用模态框 ============ */}
      <Modal
        open={createOpen}
        onClose={closeCreateModal}
        title="创建 OAuth 应用"
        size="lg"
      >
        <div className="space-y-5">
          {/* 应用名称 */}
          <FormField label="应用名称 *">
            <Input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="如：我的博客"
            />
          </FormField>

          {/* 回调地址（动态） */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="admin-label">回调地址 *</label>
              <button
                type="button"
                onClick={addRedirectUri}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <Icons.Plus className="w-3.5 h-3.5" />
                添加
              </button>
            </div>
            <div className="space-y-2">
              {redirectUris.map((uri, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={uri}
                    onChange={(e) => updateRedirectUri(i, e.target.value)}
                    placeholder="https://example.com/callback"
                  />
                  <IconButton
                    icon={<Icons.Close className="w-4 h-4" />}
                    onClick={() => removeRedirectUri(i)}
                    title="删除该回调地址"
                    variant="danger"
                  />
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              授权完成后将用户重定向到此地址，可配置多个
            </p>
          </div>

          {/* 应用描述 */}
          <FormField label="应用描述">
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              rows={2}
              placeholder="简要描述应用用途（可选）"
            />
          </FormField>

          {/* 主页 URL */}
          <FormField label="主页 URL">
            <Input
              type="text"
              value={form.homepage}
              onChange={(e) =>
                setForm((p) => ({ ...p, homepage: e.target.value }))
              }
              placeholder="https://example.com（可选）"
            />
          </FormField>

          {/* Logo URL */}
          <FormField label="Logo URL">
            <Input
              type="text"
              value={form.logo}
              onChange={(e) =>
                setForm((p) => ({ ...p, logo: e.target.value }))
              }
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
          </FormField>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="secondary"
            onClick={closeCreateModal}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleCreate} loading={submitting}>
            {submitting ? "创建中..." : "创建应用"}
          </Button>
        </div>
      </Modal>

      {/* ============ 创建成功 - 展示凭证（仅一次） ============ */}
      <Modal
        open={!!createdSecret}
        onClose={() => setCreatedSecret(null)}
        title="应用创建成功"
        size="md"
      >
        {createdSecret && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">{createdSecret.name}</p>

            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <svg
                className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
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
              <label className="admin-label">Client ID</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 break-all">
                  {createdSecret.clientId}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(createdSecret.clientId, "Client ID")}
                >
                  复制
                </Button>
              </div>
            </div>

            {/* Client Secret */}
            <div>
              <label className="admin-label">Client Secret</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 break-all">
                  {createdSecret.clientSecret}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    handleCopy(createdSecret.clientSecret, "Client Secret")
                  }
                >
                  复制
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setCreatedSecret(null)}>我已保存</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============ 删除确认 ============ */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除"
        message={`确定要删除 OAuth 应用「${deleteTarget?.name}」吗？此操作不可撤销，将同时清除该应用关联的所有授权码与令牌。`}
        confirmText="删除"
        danger
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </AdminLayout>
  );
}
