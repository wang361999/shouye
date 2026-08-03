"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import toast from "react-hot-toast";
import {
  PageHeader,
  Card,
  Button,
  Select,
  SearchInput,
  Pagination,
  ConfirmDialog,
  EmptyState,
  TableLoading,
  DataTable,
  IconButton,
  Icons,
} from "@/components/admin/ui";

interface Tool {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string | null;
  category: string | null;
  isActive: boolean;
  isFeatured: boolean;
  needLogin: boolean;
  coverImage: string | null;
  clickCount: number;
  sortOrder: number;
  createdAt: string;
}

type StatusFilter = "all" | "online" | "offline";
type CategoryFilter = "all" | "开发工具" | "AI工具" | "效率工具";

const CATEGORY_OPTIONS: CategoryFilter[] = [
  "all",
  "开发工具",
  "AI工具",
  "效率工具",
];

const PAGE_SIZE = 10;

export default function ToolsListPage() {
  const { token } = useAppStore();
  const router = useRouter();

  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Tool | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchTools = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminFetch("/api/tools");
      if (res.status === 401) {
        toast.error("登录已过期，请重新登录");
        return;
      }
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setTools(data);
    } catch {
      toast.error("获取工具列表失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchTools();
  }, [token, fetchTools]);

  // 前端筛选 + 搜索
  const filteredTools = useMemo(() => {
    let list = tools;
    if (statusFilter === "online") {
      list = list.filter((t) => t.isActive);
    } else if (statusFilter === "offline") {
      list = list.filter((t) => !t.isActive);
    }
    if (categoryFilter !== "all") {
      list = list.filter((t) => t.category === categoryFilter);
    }
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(kw) ||
          (t.description || "").toLowerCase().includes(kw)
      );
    }
    return list;
  }, [tools, statusFilter, categoryFilter, searchKeyword]);

  // 分页
  const totalPages = Math.max(1, Math.ceil(filteredTools.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedTools = filteredTools.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // 筛选条件变化时回到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, statusFilter, categoryFilter]);

  async function handleToggleActive(tool: Tool) {
    try {
      setTogglingId(tool.id);
      const res = await adminFetch(`/api/tools/${tool.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !tool.isActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "操作失败");
        return;
      }
      toast.success(tool.isActive ? "已下线" : "已上线");
      setTools((prev) =>
        prev.map((t) =>
          t.id === tool.id ? { ...t, isActive: !t.isActive } : t
        )
      );
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    try {
      setDeleting(true);
      const res = await adminFetch(`/api/tools/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success("工具已删除");
      setTools((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast.error("删除失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  }

  const hasFilter =
    searchKeyword || statusFilter !== "all" || categoryFilter !== "all";

  return (
    <AdminLayout activeKey="tools">
      <div className="space-y-6">
        {/* 页头 */}
        <PageHeader
          title="工具管理"
          actions={
            <Button onClick={() => router.push("/admin/tools/new")}>
              <Icons.Plus className="w-4 h-4 mr-1" />
              添加工具
            </Button>
          }
        />

        {/* 搜索筛选栏 */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={searchKeyword}
              onChange={setSearchKeyword}
              placeholder="搜索工具名称或描述..."
            />
            <Select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilter)
              }
            >
              <option value="all">全部状态</option>
              <option value="online">已上线</option>
              <option value="offline">已下线</option>
            </Select>
            <Select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as CategoryFilter)
              }
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "all" ? "全部分类" : cat}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        {/* 工具表格 */}
        {loading ? (
          <Card>
            <DataTable headers={["图标", "名称", "状态", "排序值", "链接", "访问量", "操作"]}>
              <TableLoading cols={7} rows={5} />
            </DataTable>
          </Card>
        ) : pagedTools.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icons.Tool className="w-12 h-12" />}
              title={hasFilter ? "没有符合条件的工具" : "暂无工具，点击上方按钮添加"}
              action={
                hasFilter ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearchKeyword("");
                      setStatusFilter("all");
                      setCategoryFilter("all");
                    }}
                  >
                    清空筛选条件
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card>
            <DataTable headers={["图标", "名称", "状态", "排序值", "链接", "访问量", "操作"]}>
              {pagedTools.map((tool) => (
                <tr key={tool.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xl">{tool.icon || "🔧"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {tool.name}
                    </div>
                    {tool.category && (
                      <span className="text-xs text-gray-400">
                        {tool.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(tool)}
                      disabled={togglingId === tool.id}
                      title="点击切换上线/下线状态"
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 ${
                        tool.isActive
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                      }`}
                    >
                      {tool.isActive ? "🟢 上线" : "🔴 下线"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {tool.sortOrder}
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate block"
                      title={tool.url}
                    >
                      {tool.url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {tool.clickCount}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        icon={<Icons.Edit />}
                        onClick={() =>
                          router.push(`/admin/tools/${tool.id}/edit`)
                        }
                        title="编辑"
                      />
                      <IconButton
                        icon={<Icons.Trash />}
                        onClick={() => setDeleteTarget(tool)}
                        title="删除"
                        variant="danger"
                      />
                      <IconButton
                        icon={<Icons.Chart />}
                        onClick={() =>
                          router.push(`/admin/tools/${tool.id}/edit`)
                        }
                        title="统计"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </Card>
        )}

        {/* 底部：总数 + 分页 */}
        {!loading && filteredTools.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-gray-500">
              共 <span className="font-medium text-gray-700">{filteredTools.length}</span> 个工具
            </div>
            <Pagination
              page={safePage}
              totalPages={totalPages}
              onChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除"
        message={
          deleteTarget
            ? `确定要删除工具「${deleteTarget.name}」吗？此操作会将工具下线，不可撤销。`
            : ""
        }
        confirmText={deleting ? "删除中..." : "确认删除"}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}
