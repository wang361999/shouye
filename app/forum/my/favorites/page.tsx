'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import { useAppStore } from '@/lib/store';
import { formatTimeAgo, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ============ 类型定义 ============
interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  recentPosts: {
    id: string;
    title: string;
    createdAt: string;
    collectedAt: string;
    author: { id: string; username: string; avatar: string | null };
  }[];
}

interface CollectedPost {
  itemId: string;
  collectedAt: string;
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isEssence: boolean;
  postType: string;
  author: { id: string; username: string; avatar: string | null };
  category: { id: string; name: string; slug: string } | null;
}

interface CollectionDetail {
  collection: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
  };
  posts: CollectedPost[];
  total: number;
  page: number;
  totalPages: number;
}

export default function MyFavoritesPage() {
  const router = useRouter();
  const { user, token, hydrate, _hydrated } = useAppStore();

  // ---- 收藏夹列表状态 ----
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ---- 创建收藏夹表单 ----
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  // ---- 收藏夹详情状态 ----
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);

  // ---- 添加帖子 ----
  const [addPostInput, setAddPostInput] = useState('');
  const [addingPost, setAddingPost] = useState(false);

  // ============ 客户端水合 ============
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // ============ 未登录重定向 ============
  useEffect(() => {
    if (_hydrated && !user) {
      toast.error('请先登录');
      router.replace('/login');
    }
  }, [_hydrated, user, router]);

  // ============ 获取收藏夹列表 ============
  const fetchCollections = useCallback(async () => {
    if (!token) return;
    setCollectionsLoading(true);
    try {
      const res = await fetch('/api/user/collections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '获取收藏夹失败');
      }
      const data = await res.json();
      setCollections(data.collections || []);
    } catch (err: any) {
      toast.error(err.message || '获取收藏夹失败');
    } finally {
      setCollectionsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchCollections();
  }, [token, fetchCollections]);

  // 默认选中第一个收藏夹
  useEffect(() => {
    if (collections.length > 0 && !selectedId) {
      setSelectedId(collections[0].id);
    }
    // 若选中的收藏夹已被删除，则清空选择
    if (selectedId && collections.length > 0 && !collections.some((c) => c.id === selectedId)) {
      setSelectedId(collections[0].id);
    }
    if (collections.length === 0) {
      setSelectedId(null);
      setDetail(null);
    }
  }, [collections, selectedId]);

  // ============ 获取收藏夹详情 ============
  const fetchDetail = useCallback(
    async (id: string, p = 1) => {
      if (!token) return;
      setDetailLoading(true);
      try {
        const res = await fetch(
          `/api/user/collections/${id}?page=${p}&limit=10`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || '获取收藏夹详情失败');
        }
        const data: CollectionDetail = await res.json();
        setDetail(data);
        setPage(data.page);
      } catch (err: any) {
        toast.error(err.message || '获取收藏夹详情失败');
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (token && selectedId) {
      fetchDetail(selectedId, 1);
    } else {
      setDetail(null);
    }
  }, [token, selectedId, fetchDetail]);

  // ============ 创建收藏夹 ============
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast.error('收藏夹名称不能为空');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/user/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: trimmedName,
          description: newDescription.trim() || undefined,
          isPublic: newIsPublic,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '创建失败');
      }
      const created = await res.json();
      toast.success('收藏夹创建成功');
      // 重置表单
      setNewName('');
      setNewDescription('');
      setNewIsPublic(true);
      setShowCreateForm(false);
      // 刷新列表并选中新创建的
      await fetchCollections();
      setSelectedId(created.id);
    } catch (err: any) {
      toast.error(err.message || '创建收藏夹失败');
    } finally {
      setCreating(false);
    }
  };

  // ============ 删除收藏夹 ============
  const handleDeleteCollection = async (id: string, name: string) => {
    if (!token) return;
    if (!window.confirm(`确定删除收藏夹「${name}」吗？该操作不可恢复，收藏的帖子将被移除。`)) {
      return;
    }
    try {
      const res = await fetch(`/api/user/collections/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '删除失败');
      }
      toast.success('收藏夹已删除');
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      await fetchCollections();
    } catch (err: any) {
      toast.error(err.message || '删除收藏夹失败');
    }
  };

  // ============ 从收藏夹移除帖子 ============
  const handleRemovePost = async (postId: string, postTitle: string) => {
    if (!token || !selectedId) return;
    if (!window.confirm(`确定将「${postTitle}」移出该收藏夹吗？`)) {
      return;
    }
    try {
      const res = await fetch(`/api/user/collections/${selectedId}/items`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '移除失败');
      }
      toast.success('已移出收藏夹');
      // 刷新详情与列表（itemCount 变化）
      await Promise.all([fetchDetail(selectedId, page), fetchCollections()]);
    } catch (err: any) {
      toast.error(err.message || '移除帖子失败');
    }
  };

  // ============ 添加帖子到收藏夹 ============
  // 支持直接输入 postId 或粘贴帖子链接 /forum/post/{id}
  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedId) return;
    const raw = addPostInput.trim();
    if (!raw) {
      toast.error('请输入帖子 ID 或帖子链接');
      return;
    }
    // 从输入中提取 postId
    let postId = raw;
    const match = raw.match(/\/forum\/post\/([^/?#]+)/);
    if (match) {
      postId = match[1];
    }
    setAddingPost(true);
    try {
      const res = await fetch(`/api/user/collections/${selectedId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '添加失败');
      }
      toast.success('已加入收藏夹');
      setAddPostInput('');
      await Promise.all([fetchDetail(selectedId, page), fetchCollections()]);
    } catch (err: any) {
      toast.error(err.message || '添加帖子失败');
    } finally {
      setAddingPost(false);
    }
  };

  const handlePageChange = (p: number) => {
    if (!selectedId) return;
    fetchDetail(selectedId, p);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ============ 加载态 / 未登录态 ============
  if (!_hydrated || !user) {
    return (
      <Container className="py-16 text-center">
        <p className="text-gray-500">正在跳转到登录页...</p>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/forum"
          className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          &larr; 返回论坛
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/forum/my/posts"
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            我的帖子
          </Link>
          <Link
            href="/forum/my/comments"
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            我的评论 &rarr;
          </Link>
        </div>
      </div>

      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        📚 我的收藏夹
      </h1>

      {/* 主体：左右两栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ============ 左侧：收藏夹列表 ============ */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* 列表头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">
                收藏夹 ({collections.length})
              </h2>
              <button
                onClick={() => setShowCreateForm((v) => !v)}
                className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                {showCreateForm ? '取消' : '+ 新建'}
              </button>
            </div>

            {/* 创建表单 */}
            {showCreateForm && (
              <form
                onSubmit={handleCreate}
                className="px-4 py-3 border-b border-gray-100 bg-gray-50 space-y-3"
              >
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={50}
                    placeholder="收藏夹名称"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    描述（可选）
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    maxLength={200}
                    rows={2}
                    placeholder="收藏夹描述"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsPublic}
                    onChange={(e) => setNewIsPublic(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  公开收藏夹
                </label>
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? '创建中...' : '创建收藏夹'}
                </button>
              </form>
            )}

            {/* 收藏夹列表 */}
            {collectionsLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-14 bg-gray-100 rounded-md animate-pulse"
                  />
                ))}
              </div>
            ) : collections.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-3xl mb-2">📁</p>
                <p className="text-sm text-gray-400 mb-3">还没有收藏夹</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  创建第一个收藏夹
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {collections.map((c) => (
                  <li key={c.id}>
                    <div
                      className={cn(
                        'group flex items-start justify-between px-4 py-3 cursor-pointer transition-colors',
                        selectedId === c.id
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-50',
                      )}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {c.name}
                          </span>
                          {!c.isPublic && (
                            <span className="text-xs text-gray-400">🔒</span>
                          )}
                        </div>
                        {c.description && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {c.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400">
                            {c.itemCount} 篇帖子
                          </span>
                          <span className="text-xs text-gray-300">·</span>
                          <span className="text-xs text-gray-400">
                            {formatTimeAgo(c.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCollection(c.id, c.name);
                        }}
                        className="ml-2 opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-red-500 transition-all"
                        title="删除收藏夹"
                      >
                        删除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ============ 右侧：收藏夹详情 / 帖子列表 ============ */}
        <div className="lg:col-span-2">
          {!selectedId ? (
            <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
              <p className="text-4xl mb-3">📑</p>
              <p className="text-gray-400">
                请在左侧选择一个收藏夹，或创建新的收藏夹
              </p>
            </div>
          ) : detailLoading && !detail ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse"
                >
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {/* 收藏夹信息头部 */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900 truncate">
                        {detail.collection.name}
                      </h2>
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs rounded-full',
                          detail.collection.isPublic
                            ? 'bg-green-50 text-green-600'
                            : 'bg-gray-100 text-gray-500',
                        )}
                      >
                        {detail.collection.isPublic ? '公开' : '私有'}
                      </span>
                    </div>
                    {detail.collection.description && (
                      <p className="text-sm text-gray-500 mt-1">
                        {detail.collection.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      共 {detail.collection.itemCount} 篇帖子 · 创建于{' '}
                      {formatTimeAgo(detail.collection.createdAt)}
                    </p>
                  </div>
                </div>

                {/* 添加帖子表单 */}
                <form
                  onSubmit={handleAddPost}
                  className="mt-4 flex gap-2 pt-4 border-t border-gray-100"
                >
                  <input
                    type="text"
                    value={addPostInput}
                    onChange={(e) => setAddPostInput(e.target.value)}
                    placeholder="输入帖子 ID 或帖子链接，加入收藏夹"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={addingPost}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {addingPost ? '添加中...' : '加入'}
                  </button>
                </form>
              </div>

              {/* 帖子列表 */}
              {detail.posts.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-sm text-gray-400">
                    这个收藏夹还没有收藏帖子
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {detail.posts.map((post) => (
                    <div
                      key={post.id}
                      className="group bg-white rounded-lg border border-gray-200 p-5 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {/* 标题行 */}
                          <div className="flex items-center gap-2 mb-1.5">
                            {post.isPinned && (
                              <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-500 rounded">
                                置顶
                              </span>
                            )}
                            {post.isEssence && (
                              <span className="text-xs px-1.5 py-0.5 bg-yellow-50 text-yellow-600 rounded">
                                精华
                              </span>
                            )}
                            {post.postType === 'question' && (
                              <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">
                                问答
                              </span>
                            )}
                            <Link
                              href={`/forum/post/${post.id}`}
                              className="text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate"
                            >
                              {post.title}
                            </Link>
                          </div>

                          {/* 摘要 */}
                          {post.summary && (
                            <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                              {post.summary}
                            </p>
                          )}

                          {/* 元信息 */}
                          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                            <Link
                              href={`/forum/post/${post.id}`}
                              className="hover:text-blue-600 transition-colors"
                            >
                              👤 {post.author.username}
                            </Link>
                            {post.category && (
                              <span>📂 {post.category.name}</span>
                            )}
                            <span>👁 {post.viewCount}</span>
                            <span>❤ {post.likeCount}</span>
                            <span>💬 {post.commentCount}</span>
                            <span>发表于 {formatTimeAgo(post.createdAt)}</span>
                            <span>· 收藏于 {formatTimeAgo(post.collectedAt)}</span>
                          </div>
                        </div>

                        {/* 移出按钮 */}
                        <button
                          onClick={() => handleRemovePost(post.id, post.title)}
                          className="shrink-0 px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-md hover:text-red-500 hover:border-red-200 transition-colors"
                          title="移出收藏夹"
                        >
                          移出
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* 分页器 */}
                  {detail.totalPages > 1 && (
                    <div className="flex items-center justify-center space-x-1 pt-2">
                      <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1}
                        className={cn(
                          'px-3 py-1.5 text-sm rounded-md border transition-colors',
                          page <= 1
                            ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                            : 'text-gray-600 border-gray-300 hover:bg-gray-50',
                        )}
                      >
                        上一页
                      </button>
                      <span className="px-3 py-1.5 text-sm text-gray-500">
                        {page} / {detail.totalPages}
                      </span>
                      <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= detail.totalPages}
                        className={cn(
                          'px-3 py-1.5 text-sm rounded-md border transition-colors',
                          page >= detail.totalPages
                            ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                            : 'text-gray-600 border-gray-300 hover:bg-gray-50',
                        )}
                      >
                        下一页
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
