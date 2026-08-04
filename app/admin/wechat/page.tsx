"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  Input,
  DataTable,
  EmptyState,
  TableLoading,
  Pagination,
  IconButton,
  ConfirmDialog,
  Icons,
  Spinner,
} from "@/components/admin/ui";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import toast from "react-hot-toast";

// ============ Types ============
type SyncStatus = "draft" | "published" | "failed" | "deleted" | "generated";
type AccountType = "personal" | "enterprise";

interface WeChatConfig {
  configured: boolean;
  appId?: string;
  accountType?: AccountType;
}

interface SyncRecord {
  id: string;
  postId: string;
  postTitle: string;
  status: SyncStatus;
  syncedBy: { id: string; username: string } | null;
  createdAt: string;
  errorMessage?: string | null;
  wechatMediaId?: string | null;
}

interface SyncHistoryResponse {
  records: SyncRecord[];
  total: number;
  totalPages: number;
  page: number;
  config: WeChatConfig;
}

interface PreviewData {
  title: string;
  content: string;
  digest: string;
  author: string;
}

// ============ Constants ============
const PAGE_SIZE = 20;

const STATUS_META: Record<
  SyncStatus,
  { label: string; color: "blue" | "green" | "red" | "gray" | "purple" }
> = {
  draft: { label: "草稿", color: "blue" },
  published: { label: "已发布", color: "green" },
  failed: { label: "失败", color: "red" },
  deleted: { label: "已删除", color: "gray" },
  generated: { label: "已生成", color: "purple" },
};

// ============ Helpers ============
function formatDateTime(iso: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

function maskAppId(appId?: string): string {
  if (!appId) return "-";
  if (appId.length <= 8) return appId.replace(/.(?=.{2})/g, "*");
  return `${appId.slice(0, 4)}****${appId.slice(-4)}`;
}

/** 从输入中解析帖子 ID，支持纯 ID 与帖子链接 */
function parsePostId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const segs = url.pathname.split("/").filter(Boolean);
      const postIdx = segs.findIndex((s) => s === "post");
      if (postIdx !== -1 && segs[postIdx + 1]) return segs[postIdx + 1];
      const last = segs[segs.length - 1];
      return last || null;
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/")) {
    const segs = trimmed.split("/").filter(Boolean);
    const postIdx = segs.findIndex((s) => s === "post");
    if (postIdx !== -1 && segs[postIdx + 1]) return segs[postIdx + 1];
  }

  return trimmed;
}

// ============ Page ============
export default function WeChatSyncPage() {
  const { token } = useAppStore();

  const [config, setConfig] = useState<WeChatConfig>({ configured: false });
  const [configLoaded, setConfigLoaded] = useState(false);
  const [records, setRecords] = useState<SyncRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 手动同步
  const [syncInput, setSyncInput] = useState("");
  const [syncing, setSyncing] = useState(false);

  // 行操作
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SyncRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 预览弹窗（个人号模式）
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const isPersonal = config.accountType === "personal";
  const isConfigured = config.configured;

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(PAGE_SIZE),
      });
      const res = await adminFetch(`/api/wechat/sync?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `获取同步记录失败 (${res.status})`);
      }
      const data: SyncHistoryResponse = await res.json();
      setConfig(data.config || { configured: false });
      setConfigLoaded(true);
      setRecords(
        (data.records || []).map((r) => ({
          ...r,
          id: String(r.id),
          postId: String(r.postId),
        })),
      );
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "获取同步记录失败");
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    if (token) fetchHistory();
  }, [token, fetchHistory]);

  // 手动同步
  async function handleSync() {
    if (syncing) return;
    const postId = parsePostId(syncInput);
    if (!postId) {
      toast.error("请输入有效的帖子 ID 或帖子链接");
      return;
    }
    try {
      setSyncing(true);
      const res = await adminFetch("/api/wechat/sync", {
        method: "POST",
        body: JSON.stringify({ postId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "同步失败");
      }

      if (isPersonal && data.preview) {
        // 个人号模式：直接显示生成的内容
        setPreviewData(data.preview);
        toast.success("内容已生成，请复制到公众号后台");
      } else {
        toast.success(data.message || "已提交同步任务");
      }
      setSyncInput("");
      setCurrentPage(1);
      await fetchHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "同步失败，请稍后重试");
    } finally {
      setSyncing(false);
    }
  }

  // 查看已生成内容（个人号模式，从记录重新获取）
  async function handleViewContent(record: SyncRecord) {
    if (actionLoading) return;
    try {
      setActionLoading(`view-${record.id}`);
      setPreviewLoading(true);
      const res = await adminFetch("/api/wechat/preview", {
        method: "POST",
        body: JSON.stringify({ postId: record.postId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "获取内容失败");
      }
      setPreviewData({
        title: data.title,
        content: data.content,
        digest: data.digest,
        author: data.author,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "获取内容失败");
    } finally {
      setActionLoading(null);
      setPreviewLoading(false);
    }
  }

  // 复制内容到剪贴板
  async function handleCopyContent() {
    if (!previewData) return;
    try {
      // 构建完整的图文内容（标题 + 正文）
      const fullContent = `<h1 style="font-size:24px;font-weight:bold;margin:20px 0 12px;color:#24292e;">${previewData.title}</h1>\n${previewData.content}`;
      await navigator.clipboard.writeText(fullContent);
      setCopied(true);
      toast.success("内容已复制到剪贴板，请粘贴到公众号后台编辑器");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // 降级方案：使用 textarea
      const textarea = document.createElement("textarea");
      const fullContent = `<h1 style="font-size:24px;font-weight:bold;margin:20px 0 12px;color:#24292e;">${previewData.title}</h1>\n${previewData.content}`;
      textarea.value = fullContent;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        toast.success("内容已复制，请粘贴到公众号后台编辑器");
        setTimeout(() => setCopied(false), 3000);
      } catch {
        toast.error("复制失败，请手动选择内容复制");
      }
      document.body.removeChild(textarea);
    }
  }

  // 发布草稿到公众号（仅企业号模式）
  async function handlePublish(record: SyncRecord) {
    if (actionLoading || record.status !== "draft") return;
    try {
      setActionLoading(`publish-${record.id}`);
      const res = await adminFetch("/api/wechat/publish", {
        method: "POST",
        body: JSON.stringify({ syncId: record.id }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "发布失败");
      }
      toast.success("已发布到公众号");
      setRecords((prev) =>
        prev.map((r) =>
          r.id === record.id ? { ...r, status: "published" as SyncStatus } : r,
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发布失败，请稍后重试");
    } finally {
      setActionLoading(null);
    }
  }

  // 删除草稿
  async function handleDeleteDraft() {
    if (!deleteTarget || deleting) return;
    try {
      setDeleting(true);
      // 个人号模式的 generated 记录不需要调用微信 API 删除
      if (deleteTarget.status === "generated") {
        setRecords((prev) =>
          prev.map((r) =>
            r.id === deleteTarget.id
              ? { ...r, status: "deleted" as SyncStatus }
              : r,
          ),
        );
        toast.success("记录已删除");
        setDeleteTarget(null);
        return;
      }
      const res = await adminFetch(`/api/wechat/sync/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "删除失败");
      }
      toast.success("草稿已删除");
      setRecords((prev) =>
        prev.map((r) =>
          r.id === deleteTarget.id
            ? { ...r, status: "deleted" as SyncStatus }
            : r,
        ),
      );
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  }

  const publishLoadingId =
    actionLoading?.startsWith("publish-") ? actionLoading : null;
  const viewLoadingId =
    actionLoading?.startsWith("view-") ? actionLoading : null;

  return (
    <AdminLayout activeKey="wechat">
      <div className="space-y-6">
        <PageHeader
          title="公众号同步"
          subtitle={
            isPersonal
              ? "个人号模式：生成微信格式内容，手动复制到公众号后台发布"
              : "将论坛帖子同步至微信公众号，支持草稿管理与一键发布"
          }
          actions={
            <Link
              href="/admin/settings"
              className="admin-btn-secondary inline-flex items-center gap-1.5"
            >
              <Icons.Settings className="w-4 h-4" />
              同步设置
            </Link>
          }
        />

        {/* 状态横幅 */}
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
            isConfigured
              ? isPersonal
                ? "bg-blue-50 border-blue-200"
                : "bg-green-50 border-green-200"
              : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <div
            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
              isConfigured
                ? isPersonal
                  ? "bg-blue-500"
                  : "bg-green-500"
                : "bg-yellow-500"
            }`}
          >
            {isConfigured ? (
              <Icons.Check className="w-3.5 h-3.5 text-white" />
            ) : (
              <span className="text-white text-xs font-bold leading-none">!</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-medium ${
                isConfigured
                  ? isPersonal
                    ? "text-blue-800"
                    : "text-green-800"
                  : "text-yellow-800"
              }`}
            >
              {isConfigured
                ? isPersonal
                  ? "微信公众号已配置（个人号模式）"
                  : "微信公众号已配置（企业号模式）"
                : "微信公众号未配置"}
            </p>
            <p
              className={`text-xs mt-0.5 ${
                isConfigured
                  ? isPersonal
                    ? "text-blue-700"
                    : "text-green-700"
                  : "text-yellow-700"
              }`}
            >
              {isConfigured
                ? isPersonal
                  ? "个人号无法调用发布 API，将生成微信格式 HTML 供你手动复制到公众号后台发布。"
                  : "已连接公众号，可进行帖子同步与发布。"
                : "请先在系统设置中配置微信公众号 AppID 与 Secret，否则无法同步。"}
            </p>
          </div>
          <Link
            href="/admin/settings"
            className="flex-shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 whitespace-nowrap"
          >
            前往设置 →
          </Link>
        </div>

        {/* 手动同步 */}
        <Card>
          <CardHeader
            title={isPersonal ? "生成微信内容" : "手动同步"}
            subtitle={
              isPersonal
                ? "输入论坛帖子 ID 或链接，生成微信公众号适配的 HTML 内容"
                : "输入论坛帖子 ID 或链接，将其同步为公众号草稿"
            }
          />
          <CardBody>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="text"
                value={syncInput}
                onChange={(e) => setSyncInput(e.target.value)}
                placeholder="输入帖子 ID 或帖子链接，例如 /forum/post/123"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !syncing && isConfigured) handleSync();
                }}
              />
              <Button
                onClick={handleSync}
                loading={syncing}
                disabled={!isConfigured}
              >
                <Icons.ExternalLink className="w-4 h-4" />
                {isPersonal ? "生成内容" : "同步到微信"}
              </Button>
            </div>
            {!isConfigured && (
              <p className="text-xs text-yellow-700 mt-2">
                微信公众号未配置，同步功能暂不可用。
              </p>
            )}
            {isPersonal && isConfigured && (
              <div className="mt-3 rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
                <p className="text-xs text-blue-800">
                  个人号模式：点击「生成内容」后将自动弹出预览窗口，可一键复制 HTML 内容，然后粘贴到微信公众号后台编辑器中发布。
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* 公众号配置 */}
        <Card>
          <CardHeader
            title="公众号配置"
            subtitle="WeChat Official Account 连接信息"
          />
          <CardBody>
            {loading && !configLoaded ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Spinner className="w-4 h-4" /> 加载中...
              </div>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <dt className="text-xs text-gray-500">AppID</dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900 font-mono break-all">
                    {maskAppId(config.appId)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">账号类型</dt>
                  <dd className="mt-1">
                    <Badge color={isPersonal ? "blue" : "green"}>
                      {isPersonal ? "个人号" : "企业号"}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">连接状态</dt>
                  <dd className="mt-1">
                    <Badge color={isConfigured ? "green" : "yellow"}>
                      {isConfigured ? "已连接" : "未连接"}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">配置入口</dt>
                  <dd className="mt-1">
                    <Link
                      href="/admin/settings"
                      className="text-sm text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Icons.Settings className="w-4 h-4" />
                      系统设置
                    </Link>
                  </dd>
                </div>
              </dl>
            )}
          </CardBody>
        </Card>

        {/* 同步记录 */}
        <Card>
          <CardHeader
            title="同步记录"
            subtitle={`共 ${totalCount} 条记录`}
            action={
              <Button variant="ghost" size="sm" onClick={fetchHistory}>
                <Icons.Search className="w-4 h-4" /> 刷新
              </Button>
            }
          />
          {loading ? (
            <DataTable
              headers={["帖子标题", "状态", "同步人", "同步时间", "操作"]}
            >
              <TableLoading cols={5} rows={6} />
            </DataTable>
          ) : records.length === 0 ? (
            <EmptyState
              icon={<Icons.Chat className="w-12 h-12" />}
              title="暂无同步记录"
              description={
                isPersonal
                  ? "通过上方「生成内容」开始将帖子生成微信格式内容"
                  : "通过上方「手动同步」开始将帖子同步到公众号"
              }
            />
          ) : (
            <DataTable
              headers={["帖子标题", "状态", "同步人", "同步时间", "操作"]}
            >
              {records.map((record) => {
                const meta =
                  STATUS_META[record.status] || {
                    label: record.status,
                    color: "gray" as const,
                  };
                const isPublishing =
                  publishLoadingId === `publish-${record.id}`;
                const isViewing =
                  viewLoadingId === `view-${record.id}`;
                return (
                  <tr
                    key={record.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 max-w-[280px]">
                      <Link
                        href={`/forum/post/${record.postId}`}
                        className="text-gray-900 hover:text-brand-600 hover:underline line-clamp-1 block"
                        title={record.postTitle}
                      >
                        {record.postTitle || `帖子 #${record.postId}`}
                      </Link>
                      {record.status === "failed" && record.errorMessage && (
                        <span
                          className="text-xs text-red-500 line-clamp-1 block mt-0.5"
                          title={record.errorMessage}
                        >
                          {record.errorMessage}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge color={meta.color}>{meta.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {record.syncedBy?.username || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDateTime(record.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        {/* 个人号模式：查看内容按钮 */}
                        {isPersonal && record.status === "generated" && (
                          <IconButton
                            icon={
                              isViewing ? (
                                <Spinner className="w-4 h-4" />
                              ) : (
                                <Icons.Eye className="w-4 h-4" />
                              )
                            }
                            onClick={() => handleViewContent(record)}
                            title="查看微信内容"
                          />
                        )}
                        {/* 企业号模式：发布按钮 */}
                        {!isPersonal && record.status === "draft" && (
                          <IconButton
                            icon={
                              isPublishing ? (
                                <Spinner className="w-4 h-4" />
                              ) : (
                                <Icons.ExternalLink className="w-4 h-4" />
                              )
                            }
                            onClick={() => handlePublish(record)}
                            title="发布到公众号"
                          />
                        )}
                        {/* 删除按钮 */}
                        {(record.status === "draft" ||
                          record.status === "failed" ||
                          record.status === "generated") && (
                          <IconButton
                            icon={<Icons.Trash className="w-4 h-4" />}
                            onClick={() => setDeleteTarget(record)}
                            title="删除记录"
                            variant="danger"
                          />
                        )}
                        {(record.status === "published" ||
                          record.status === "deleted") && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>

        {/* 分页 */}
        {!loading && records.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-gray-500">
              共 <span className="font-medium text-gray-700">{totalCount}</span>{" "}
              条记录
            </div>
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除"
        message={
          deleteTarget
            ? `确定要删除帖子「${deleteTarget.postTitle}」的同步记录吗？`
            : ""
        }
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={handleDeleteDraft}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        danger
      />

      {/* 内容预览弹窗（个人号模式） */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  微信内容预览
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  复制下方内容，粘贴到微信公众号后台编辑器中发布
                </p>
              </div>
              <button
                onClick={() => {
                  setPreviewData(null);
                  setCopied(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* 文章信息 */}
              <div className="mb-4 pb-4 border-b border-gray-100">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">标题：</span>
                    <span className="font-medium text-gray-900">{previewData.title}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">作者：</span>
                    <span className="font-medium text-gray-900">{previewData.author}</span>
                  </div>
                  {previewData.digest && (
                    <div className="col-span-2">
                      <span className="text-gray-500">摘要：</span>
                      <span className="text-gray-700">{previewData.digest}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* HTML 预览 */}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">内容预览</span>
                <span className="text-xs text-gray-400">下方为微信公众号适配的渲染效果</span>
              </div>
              <div
                className="rounded-lg border border-gray-200 p-4 bg-gray-50 overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: previewData.content }}
              />

              {/* HTML 源码 */}
              <details className="mt-4">
                <summary className="text-sm text-brand-600 cursor-pointer hover:text-brand-700">
                  查看 HTML 源码（高级用户可自行编辑后复制）
                </summary>
                <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto max-h-48">
                  {previewData.content}
                </pre>
              </details>
            </div>

            {/* 弹窗底部操作 */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <div className="text-xs text-gray-500">
                {copied ? (
                  <span className="text-green-600 font-medium">已复制到剪贴板</span>
                ) : (
                  <span>点击复制后，前往公众号后台粘贴发布</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPreviewData(null);
                    setCopied(false);
                  }}
                >
                  关闭
                </Button>
                <Button onClick={handleCopyContent} disabled={copied}>
                  {copied ? (
                    <>
                      <Icons.Check className="w-4 h-4" />
                      已复制
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      复制内容
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 预览加载中 */}
      {previewLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl px-8 py-6 flex items-center gap-3">
            <Spinner className="w-6 h-6 text-brand-500" />
            <span className="text-sm text-gray-600">正在生成微信内容...</span>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
