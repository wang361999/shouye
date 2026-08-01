"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

interface Post {
  id: string;
  title: string;
  content: string;
  author: { id: string; username: string };
  category: { id: string; name: string; slug: string } | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isEssence: boolean;
  isLocked: boolean;
  status: string;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

type StatusFilter = "all" | "normal" | "pinned" | "essence" | "deleted";

const PAGE_SIZE = 15;

export default function ForumPostsPage() {
  const { token } = useAppStore();

  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 操作确认弹窗
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        admin: "1",
        page: String(currentPage),
        limit: String(PAGE_SIZE),
        search: searchKeyword.trim(),
      });

      // 状态筛选传递给 API（all 不传）
      if (statusFilter === "deleted") {
        params.set("status", "DELETED");
      } else if (statusFilter === "normal") {
        params.set("status", "PUBLISHED");
      }

      // 分类筛选传递给 API
      if (categoryFilter !== "all") {
        params.set("category", categoryFilter);
      }

      const res = await fetch(
        `/api/forum/posts?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setPosts(
        (data.posts || []).map((p: Post) => ({
          ...p,
          id: String(p.id),
          category: p.category
            ? {
                id: String(p.category.id),
                name: p.category.name,
                slug: p.category.slug,
              }
            : null,
        }))
      );
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch {
      toast.error("获取帖子列表失败");
    } finally {
      setLoading(false);
    }
  }, [token, searchKeyword, statusFilter, categoryFilter, currentPage]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/forum/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch {
      // 忽略分类获取失败
    }
  }, []);

  useEffect(() => {
    if (token) fetchPosts();
  }, [token, fetchPosts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // 筛选条件变化时重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, statusFilter, categoryFilter]);

  // 统计
  const stats = useMemo(() => {
    return { total: totalCount, todayNew: 0, deleted: 0 };
  }, [totalCount]);

  async function patchPost(post: Post, action: string) {
    try {
      setActionLoading(`${post.id}-${action}`);
      const res = await fetch(`/api/forum/posts/${post.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "操作失败");
        return;
      }
      const data = await res.json();
      toast.success(data.message);
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== post.id) return p;
          return {
            ...p,
            isPinned: data.isPinned !== undefined ? data.isPinned : p.isPinned,
            isEssence:
              data.isEssence !== undefined ? data.isEssence : p.isEssence,
            isLocked:
              data.isLocked !== undefined ? data.isLocked : p.isLocked,
          };
        })
      );
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/forum/posts/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success("帖子已删除");
      setPosts((prev) =>
        prev.map((p) =>
          p.id === deleteTarget.id ? { ...p, status: "DELETED" } : p
        )
      );
      setDeleteTarget(null);
    } catch {
      toast.error("删除失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminLayout activeKey="forum-posts">
      <div className="space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900">💬 帖子管理</h1>
          <Link
            href="/forum/new"
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
            发布公告
          </Link>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="总帖子" value={stats.total} icon="📝" color="blue" />
          <StatCard
            label="今日新增"
            value={stats.todayNew}
            icon="🆕"
            color="green"
          />
          <StatCard
            label="已删除"
            value={stats.deleted}
            icon="⛔"
            color="red"
          />
        </div>

        {/* 搜索筛选栏 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchPosts();
                }}
                placeholder="搜索帖子标题或内容..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部分类</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilter)
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部状态</option>
              <option value="normal">正常</option>
              <option value="pinned">置顶</option>
              <option value="essence">精华</option>
              <option value="deleted">已删除</option>
            </select>
            <button
              onClick={fetchPosts}
              className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              搜索
            </button>
          </div>
        </div>

        {/* 帖子表格 */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="animate-pulse p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-gray-500">
              {searchKeyword ||
              statusFilter !== "all" ||
              categoryFilter !== "all"
                ? "没有符合条件的帖子"
                : "暂无帖子"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      标题
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      分类
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      作者
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      回复
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      点赞
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      状态
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {posts.map((post) => (
                    <tr
                      key={post.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 max-w-[240px]">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/forum/post/${post.id}`}
                            className="text-gray-900 hover:text-blue-600 hover:underline line-clamp-1 block"
                            title={post.title}
                          >
                            {post.title}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {post.category?.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {post.author.username}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {post.commentCount}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {post.likeCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {post.status === "DELETED" ? (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                              ⛔ 已删
                            </span>
                          ) : (
                            <>
                              {post.isPinned && (
                                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600 border border-red-200">
                                  📌 置顶
                                </span>
                              )}
                              {post.isEssence && (
                                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                  ⭐ 精华
                                </span>
                              )}
                              {post.isLocked && (
                                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                                  🔒 锁定
                                </span>
                              )}
                              {!post.isPinned &&
                                !post.isEssence &&
                                !post.isLocked && (
                                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-600 border border-green-200">
                                    ✓ 正常
                                  </span>
                                )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5 flex-wrap">
                          <Link
                            href={`/forum/post/${post.id}/edit`}
                            title="编辑"
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            ✏️
                          </Link>
                          <Link
                            href={`/forum/post/${post.id}`}
                            title="查看"
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          >
                            👁
                          </Link>
                          <button
                            onClick={() => patchPost(post, "pin")}
                            disabled={
                              actionLoading === `${post.id}-pin` ||
                              post.status === "DELETED"
                            }
                            title={post.isPinned ? "取消置顶" : "置顶"}
                            className={`p-1.5 rounded transition-colors disabled:opacity-30 ${
                              post.isPinned
                                ? "text-red-600 hover:bg-red-50"
                                : "text-gray-500 hover:text-red-600 hover:bg-red-50"
                            }`}
                          >
                            📌
                          </button>
                          <button
                            onClick={() => patchPost(post, "essence")}
                            disabled={
                              actionLoading === `${post.id}-essence` ||
                              post.status === "DELETED"
                            }
                            title={post.isEssence ? "取消精华" : "加精"}
                            className={`p-1.5 rounded transition-colors disabled:opacity-30 ${
                              post.isEssence
                                ? "text-orange-600 hover:bg-orange-50"
                                : "text-gray-500 hover:text-orange-600 hover:bg-orange-50"
                            }`}
                          >
                            ⭐
                          </button>
                          <button
                            onClick={() =>
                              patchPost(post, post.isLocked ? "unlock" : "lock")
                            }
                            disabled={
                              actionLoading === `${post.id}-lock` ||
                              actionLoading === `${post.id}-unlock` ||
                              post.status === "DELETED"
                            }
                            title={post.isLocked ? "解锁" : "锁定"}
                            className={`p-1.5 rounded transition-colors disabled:opacity-30 ${
                              post.isLocked
                                ? "text-yellow-600 hover:bg-yellow-50"
                                : "text-gray-500 hover:text-yellow-600 hover:bg-yellow-50"
                            }`}
                          >
                            🔒
                          </button>
                          {post.status !== "DELETED" && (
                            <button
                              onClick={() => setDeleteTarget(post)}
                              title="删除"
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 底部分页 */}
        {!loading && posts.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-gray-500">
              共 <span className="font-medium text-gray-700">{totalCount}</span> 篇帖子
            </div>
            <Pagination
              currentPage={currentPage}
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
              确定要删除帖子「{deleteTarget.title}」吗？此为软删除，可在数据库恢复。
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

// ============ 统计卡片 ============
function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: "blue" | "green" | "red";
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-green-50 text-green-700 border-green-100",
    red: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <div
      className={`rounded-xl border p-4 flex items-center gap-3 ${colorMap[color]}`}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs opacity-80">{label}</div>
      </div>
    </div>
  );
}

// ============ 分页器 ============
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
