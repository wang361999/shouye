"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

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
      const res = await fetch("/api/tools", {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      const res = await fetch(`/api/tools/${tool.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/tools/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
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

  return (
    <AdminLayout activeKey="tools">
      <div className="space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900">🧩 工具管理</h1>
          <Link
            href="/admin/tools/new"
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
            添加工具
          </Link>
        </div>

        {/* 搜索筛选栏 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* 搜索框 */}
            <div className="relative flex-1 min-w-[200px]">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索工具名称或描述..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {/* 状态筛选 */}
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilter)
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部状态</option>
              <option value="online">已上线</option>
              <option value="offline">已下线</option>
            </select>
            {/* 分类筛选 */}
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as CategoryFilter)
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "all" ? "全部分类" : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 工具表格 */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="animate-pulse p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        ) : pagedTools.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-gray-500 mb-4">
              {searchKeyword || statusFilter !== "all" || categoryFilter !== "all"
                ? "没有符合条件的工具"
                : "暂无工具，点击上方按钮添加"}
            </p>
            {(searchKeyword ||
              statusFilter !== "all" ||
              categoryFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchKeyword("");
                  setStatusFilter("all");
                  setCategoryFilter("all");
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                清空筛选条件
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      图标
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      名称
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      状态
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      排序值
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      链接
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      访问量
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedTools.map((tool) => (
                    <tr
                      key={tool.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
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
                          <Link
                            href={`/admin/tools/${tool.id}/edit`}
                            title="编辑"
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            ✏️
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(tool)}
                            title="删除"
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            🗑️
                          </button>
                          <Link
                            href={`/admin/tools/${tool.id}/edit`}
                            title="统计"
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          >
                            📊
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 底部：总数 + 分页 */}
        {!loading && filteredTools.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-gray-500">
              共 <span className="font-medium text-gray-700">{filteredTools.length}</span> 个工具
            </div>
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">确认删除</h3>
            <p className="text-gray-500 text-sm mb-6">
              确定要删除工具「{deleteTarget.name}」吗？此操作会将工具下线，不可撤销。
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

// ============ 分页器组件 ============
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  // 生成页码数组（最多显示 7 个）
  const pages: (number | string)[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        上一页
      </button>
      {pages.map((p, i) =>
        typeof p === "number" ? (
          <button
            key={i}
            onClick={() => onPageChange(p)}
            className={`min-w-[32px] px-2 py-1.5 text-sm rounded-lg border transition-colors ${
              p === currentPage
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        ) : (
          <span key={i} className="px-2 text-gray-400">
            {p}
          </span>
        )
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        下一页
      </button>
    </div>
  );
}
