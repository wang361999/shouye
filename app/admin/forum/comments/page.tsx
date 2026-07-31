"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

interface Comment {
  id: string;
  content: string;
  author: { id: string; username: string };
  postId: string;
  post: { id: string; title: string } | null;
  likeCount: number;
  isApproved: boolean;
  createdAt: string;
}

interface Post {
  id: string;
  title: string;
}

type StatusFilter = "all" | "approved" | "pending";

const PAGE_SIZE = 15;

export default function ForumCommentsPage() {
  const { token } = useAppStore();

  const [comments, setComments] = useState<Comment[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [postFilter, setPostFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState<Comment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        approved: statusFilter === "all" ? "all" : statusFilter === "approved" ? "true" : "false",
        limit: "200",
      });
      if (searchKeyword.trim()) {
        params.set("search", searchKeyword.trim());
      }
      if (postFilter !== "all") {
        params.set("postId", postFilter);
      }
      const res = await fetch(`/api/forum/comments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setComments(
        (data.data || []).map((c: Comment) => ({
          ...c,
          id: String(c.id),
          postId: String(c.postId),
          post: c.post
            ? { id: String(c.post.id), title: c.post.title }
            : null,
        }))
      );
    } catch {
      toast.error("获取评论列表失败");
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, searchKeyword, postFilter]);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/forum/posts?limit=100");
      if (res.ok) {
        const data = await res.json();
        setPosts(
          (data.posts || []).map((p: Post) => ({
            id: String(p.id),
            title: p.title,
          }))
        );
      }
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => {
    if (token) fetchComments();
  }, [token, fetchComments]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // 分页
  const totalPages = Math.max(1, Math.ceil(comments.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedComments = comments.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, statusFilter, postFilter]);

  // 待审核数量
  const pendingCount = useMemo(() => {
    return comments.filter((c) => !c.isApproved).length;
  }, [comments]);

  async function handleApprove(comment: Comment) {
    try {
      setActionLoading(comment.id);
      const res = await fetch("/api/forum/comments", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ commentId: comment.id, action: "approve" }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "审核失败");
        return;
      }
      const data = await res.json();
      toast.success(data.message);
      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id ? { ...c, isApproved: true } : c
        )
      );
    } catch {
      toast.error("审核失败，请稍后重试");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch("/api/forum/comments", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ commentId: deleteTarget.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success("评论已删除");
      setComments((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast.error("删除失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <AdminLayout activeKey="forum-comments">
      <div className="space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900">💬 评论管理</h1>
          {pendingCount > 0 && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              有 <span className="font-bold">{pendingCount}</span> 条评论待审核
            </div>
          )}
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
                  if (e.key === "Enter") fetchComments();
                }}
                placeholder="搜索评论内容..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={postFilter}
              onChange={(e) => setPostFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部帖子</option>
              {posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title.length > 20 ? p.title.substring(0, 20) + "..." : p.title}
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
              <option value="approved">已通过</option>
              <option value="pending">待审核</option>
            </select>
            <button
              onClick={fetchComments}
              className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              搜索
            </button>
          </div>
        </div>

        {/* 评论表格 */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="animate-pulse p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        ) : pagedComments.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-gray-500">
              {searchKeyword ||
              statusFilter !== "all" ||
              postFilter !== "all"
                ? "没有符合条件的评论"
                : "暂无评论"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      评论内容
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      所属帖子
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      作者
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      时间
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      点赞
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedComments.map((comment) => (
                    <tr
                      key={comment.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 max-w-[280px]">
                        <div className="flex items-start gap-2">
                          {!comment.isApproved && (
                            <span className="flex-shrink-0 mt-0.5 inline-flex px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700">
                              待审
                            </span>
                          )}
                          <p
                            className="text-gray-700 line-clamp-2"
                            title={comment.content}
                          >
                            {comment.content}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        {comment.post ? (
                          <Link
                            href={`/forum/post/${comment.post.id}`}
                            className="text-blue-600 hover:underline line-clamp-1 block"
                            title={comment.post.title}
                          >
                            {comment.post.title}
                          </Link>
                        ) : (
                          <span className="text-gray-400">
                            帖子 #{comment.postId}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {comment.author.username}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(comment.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {comment.likeCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!comment.isApproved && (
                            <button
                              onClick={() => handleApprove(comment)}
                              disabled={actionLoading === comment.id}
                              title="通过审核"
                              className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                            >
                              ✅
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(comment)}
                            title="删除评论"
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            🗑️
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

        {/* 底部分页 */}
        {!loading && comments.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-gray-500">
              共 <span className="font-medium text-gray-700">{comments.length}</span> 条评论
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
              确定要删除这条评论吗？此操作不可撤销。
            </p>
            {deleteTarget.content && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 max-h-24 overflow-y-auto">
                {deleteTarget.content.substring(0, 100)}
                {deleteTarget.content.length > 100 ? "..." : ""}
              </div>
            )}
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
