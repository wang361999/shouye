"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import { formatDateTime } from "@/lib/admin-utils";
import toast from "react-hot-toast";
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Badge,
  DataTable,
  IconButton,
  SearchInput,
  Select,
  ConfirmDialog,
  EmptyState,
  TableLoading,
  Pagination,
  Icons,
} from "@/components/admin/ui";

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
      const res = await adminFetch(`/api/forum/comments?${params.toString()}`);
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
    if (actionLoading) return;
    try {
      setActionLoading(comment.id);
      const res = await adminFetch("/api/forum/comments", {
        method: "PATCH",
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
    if (!deleteTarget || deleting) return;
    try {
      setDeleting(true);
      const res = await adminFetch("/api/forum/comments", {
        method: "DELETE",
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

  // 删除确认消息（包含评论内容预览）
  const deleteMessage = deleteTarget
    ? `确定要删除这条评论吗？此操作不可撤销。${
        deleteTarget.content
          ? ` 评论内容：「${deleteTarget.content.substring(0, 100)}${
              deleteTarget.content.length > 100 ? "..." : ""
            }」`
          : ""
      }`
    : "";

  return (
    <AdminLayout activeKey="forum-comments">
      <div className="space-y-6">
        {/* 页头 */}
        <PageHeader
          title="评论管理"
          actions={
            pendingCount > 0 ? (
              <Badge color="yellow">
                有 {pendingCount} 条评论待审核
              </Badge>
            ) : undefined
          }
        />

        {/* 搜索筛选栏 */}
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput
                value={searchKeyword}
                onChange={setSearchKeyword}
                placeholder="搜索评论内容..."
              />
              <Select
                value={postFilter}
                onChange={(e) => setPostFilter(e.target.value)}
              >
                <option value="all">全部帖子</option>
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title.length > 20 ? p.title.substring(0, 20) + "..." : p.title}
                  </option>
                ))}
              </Select>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">全部状态</option>
                <option value="approved">已通过</option>
                <option value="pending">待审核</option>
              </Select>
              <Button variant="secondary" onClick={fetchComments}>
                搜索
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* 评论表格 */}
        {loading ? (
          <Card>
            <DataTable headers={["评论内容", "所属帖子", "作者", "时间", "点赞", "操作"]}>
              <TableLoading cols={6} rows={6} />
            </DataTable>
          </Card>
        ) : pagedComments.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icons.Comment className="w-12 h-12" />}
              title={
                searchKeyword ||
                statusFilter !== "all" ||
                postFilter !== "all"
                  ? "没有符合条件的评论"
                  : "暂无评论"
              }
            />
          </Card>
        ) : (
          <Card>
            <DataTable headers={["评论内容", "所属帖子", "作者", "时间", "点赞", "操作"]}>
              {pagedComments.map((comment) => (
                <tr
                  key={comment.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 max-w-[280px]">
                    <div className="flex items-start gap-2">
                      {!comment.isApproved && (
                        <Badge color="yellow">待审</Badge>
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
                    {formatDateTime(comment.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{comment.likeCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {!comment.isApproved && (
                        <IconButton
                          icon={<Icons.Check />}
                          onClick={() => handleApprove(comment)}
                          title="通过审核"
                        />
                      )}
                      <IconButton
                        icon={<Icons.Trash />}
                        onClick={() => setDeleteTarget(comment)}
                        title="删除评论"
                        variant="danger"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </Card>
        )}

        {/* 底部分页 */}
        {!loading && comments.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-gray-500">
              共 <span className="font-medium text-gray-700">{comments.length}</span> 条评论
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
        message={deleteMessage}
        confirmText="确认删除"
        cancelText="取消"
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        danger
      />
    </AdminLayout>
  );
}
