"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAppStore } from "@/lib/store";
import { adminFetch } from "@/lib/admin-fetch";
import toast from "react-hot-toast";
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Badge,
  StatCard,
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
  const router = useRouter();

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

      const res = await adminFetch(`/api/forum/posts?${params.toString()}`);
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
    if (actionLoading || post.status === "DELETED") return;
    try {
      setActionLoading(`${post.id}-${action}`);
      const res = await adminFetch(`/api/forum/posts/${post.id}`, {
        method: "PATCH",
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
    if (!deleteTarget || deleting) return;
    try {
      setDeleting(true);
      const res = await adminFetch(`/api/forum/posts/${deleteTarget.id}`, {
        method: "DELETE",
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
        <PageHeader
          title="帖子管理"
          actions={
            <Link
              href="/forum/new"
              className="admin-btn-primary inline-flex items-center gap-1.5"
            >
              <Icons.Plus className="w-4 h-4" />
              发布公告
            </Link>
          }
        />

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="总帖子"
            value={stats.total}
            icon={<Icons.Doc className="w-5 h-5" />}
            color="blue"
          />
          <StatCard
            label="今日新增"
            value={stats.todayNew}
            icon={<Icons.Plus className="w-5 h-5" />}
            color="green"
          />
          <StatCard
            label="已删除"
            value={stats.deleted}
            icon={<Icons.Trash className="w-5 h-5" />}
            color="red"
          />
        </div>

        {/* 搜索筛选栏 */}
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput
                value={searchKeyword}
                onChange={setSearchKeyword}
                placeholder="搜索帖子标题或内容..."
              />
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">全部分类</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </Select>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">全部状态</option>
                <option value="normal">正常</option>
                <option value="pinned">置顶</option>
                <option value="essence">精华</option>
                <option value="deleted">已删除</option>
              </Select>
              <Button variant="secondary" onClick={fetchPosts}>
                搜索
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* 帖子表格 */}
        {loading ? (
          <Card>
            <DataTable headers={["标题", "分类", "作者", "回复", "点赞", "状态", "操作"]}>
              <TableLoading cols={7} rows={6} />
            </DataTable>
          </Card>
        ) : posts.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icons.Chat className="w-12 h-12" />}
              title={
                searchKeyword ||
                statusFilter !== "all" ||
                categoryFilter !== "all"
                  ? "没有符合条件的帖子"
                  : "暂无帖子"
              }
            />
          </Card>
        ) : (
          <Card>
            <DataTable headers={["标题", "分类", "作者", "回复", "点赞", "状态", "操作"]}>
              {posts.map((post) => (
                <tr
                  key={post.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 max-w-[240px]">
                    <Link
                      href={`/forum/post/${post.id}`}
                      className="text-gray-900 hover:text-blue-600 hover:underline line-clamp-1 block"
                      title={post.title}
                    >
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {post.category?.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {post.author.username}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{post.commentCount}</td>
                  <td className="px-4 py-3 text-gray-600">{post.likeCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {post.status === "DELETED" ? (
                        <Badge color="gray">已删</Badge>
                      ) : (
                        <>
                          {post.isPinned && <Badge color="red">置顶</Badge>}
                          {post.isEssence && <Badge color="purple">精华</Badge>}
                          {post.isLocked && <Badge color="yellow">锁定</Badge>}
                          {!post.isPinned &&
                            !post.isEssence &&
                            !post.isLocked && <Badge color="green">正常</Badge>}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5 flex-wrap">
                      <IconButton
                        icon={<Icons.Edit />}
                        onClick={() => router.push(`/forum/post/${post.id}/edit`)}
                        title="编辑"
                      />
                      <IconButton
                        icon={<Icons.Eye />}
                        onClick={() => router.push(`/forum/post/${post.id}`)}
                        title="查看"
                      />
                      <IconButton
                        icon={<span className="text-base leading-none">📌</span>}
                        onClick={() => patchPost(post, "pin")}
                        title={post.isPinned ? "取消置顶" : "置顶"}
                      />
                      <IconButton
                        icon={<span className="text-base leading-none">⭐</span>}
                        onClick={() => patchPost(post, "essence")}
                        title={post.isEssence ? "取消精华" : "加精"}
                      />
                      <IconButton
                        icon={<Icons.Lock />}
                        onClick={() =>
                          patchPost(post, post.isLocked ? "unlock" : "lock")
                        }
                        title={post.isLocked ? "解锁" : "锁定"}
                      />
                      {post.status !== "DELETED" && (
                        <IconButton
                          icon={<Icons.Trash />}
                          onClick={() => setDeleteTarget(post)}
                          title="删除"
                          variant="danger"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </Card>
        )}

        {/* 底部分页 */}
        {!loading && posts.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-gray-500">
              共 <span className="font-medium text-gray-700">{totalCount}</span> 篇帖子
            </div>
            <Pagination
              page={currentPage}
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
            ? `确定要删除帖子「${deleteTarget.title}」吗？此为软删除，可在数据库恢复。`
            : ""
        }
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
