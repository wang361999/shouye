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
type SyncStatus = "draft" | "published" | "failed" | "deleted";

interface WeChatConfig {
  configured: boolean;
  appId?: string;
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

// ============ Constants ============
const PAGE_SIZE = 20;

const STATUS_META: Record<
  SyncStatus,
  { label: string; color: "blue" | "green" | "red" | "gray" }
> = {
  draft: { label: "草稿", color: "blue" },
  published: { label: "已发布", color: "green" },
  failed: { label: "失败", color: "red" },
  deleted: { label: "已删除", color: "gray" },
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

  // 链接形式：尝试从路径中提取帖子 ID
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

  // 相对路径形式：/forum/post/<id>
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
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "同步失败");
      }
      toast.success("已提交同步任务");
      setSyncInput("");
      setCurrentPage(1);
      await fetchHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "同步失败，请稍后重试");
    } finally {
      setSyncing(false);
    }
  }

  // 发布草稿到公众号
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

  const isConfigured = config.configured;
  const publishLoadingId =
    actionLoading?.startsWith("publish-") ? actionLoading : null;

  return (
    <AdminLayout activeKey="wechat">
      <div className="space-y-6">
        <PageHeader
          title="公众号同步"
          subtitle="将论坛帖子同步至微信公众号，支持草稿管理与一键发布"
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
              ? "bg-green-50 border-green-200"
              : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <div
            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
              isConfigured ? "bg-green-500" : "bg-yellow-500"
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
                isConfigured ? "text-green-800" : "text-yellow-800"
              }`}
            >
              {isConfigured ? "微信公众号已配置" : "微信公众号未配置"}
            </p>
            <p
              className={`text-xs mt-0.5 ${
                isConfigured ? "text-green-700" : "text-yellow-700"
              }`}
            >
              {isConfigured
                ? "已连接公众号，可进行帖子同步与发布。"
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
            title="手动同步"
            subtitle="输入论坛帖子 ID 或链接，将其同步为公众号草稿"
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
                同步到微信
              </Button>
            </div>
            {!isConfigured && (
              <p className="text-xs text-yellow-700 mt-2">
                微信公众号未配置，同步功能暂不可用。
              </p>
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
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <dt className="text-xs text-gray-500">AppID</dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900 font-mono break-all">
                    {maskAppId(config.appId)}
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
              description="通过上方「手动同步」开始将帖子同步到公众号"
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
                        {record.status === "draft" && (
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
                        {(record.status === "draft" ||
                          record.status === "failed") && (
                          <IconButton
                            icon={<Icons.Trash className="w-4 h-4" />}
                            onClick={() => setDeleteTarget(record)}
                            title="删除草稿"
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
        title="确认删除草稿"
        message={
          deleteTarget
            ? `确定要删除帖子「${deleteTarget.postTitle}」的公众号草稿吗？删除后将无法在公众号后台恢复。`
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
    </AdminLayout>
  );
}
