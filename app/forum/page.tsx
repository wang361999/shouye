'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import PostList from '@/components/forum/PostList';
import Sidebar from '@/components/forum/Sidebar';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { fetchWithRetry } from '@/lib/fetch-retry';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  postCount: number;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: { username: string; avatar?: string | null };
  category: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isEssence: boolean;
  createdAt: string;
  postType?: string;
  isAIGenerated?: boolean;
  tags?: { tag: { id: string; name: string; slug: string } }[];
}

interface ForumStats {
  totalPosts: number;
  totalUsers: number;
  todayPosts: number;
}

interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

type TabType = 'all' | 'discussion' | 'question' | 'following';

// Bootstrap 数据接口
interface BootstrapData {
  categories: Category[];
  stats: ForumStats;
  hotPosts: Post[];
  tags: Tag[];
}

// localStorage 缓存 key
const BOOTSTRAP_CACHE_KEY = 'forum_bootstrap_cache';
const BOOTSTRAP_CACHE_TTL = 60_000; // 60 秒

// SVG 图标
const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const QuestionIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export default function ForumPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAppStore();

  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [currentCategory, setCurrentCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [retryCount, setRetryCount] = useState(0);

  const tagFilter = searchParams.get('tag') || '';

  const [hotPosts, setHotPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<ForumStats>({
    totalPosts: 0,
    totalUsers: 0,
    todayPosts: 0,
  });
  const [sidebarTags, setSidebarTags] = useState<Tag[]>([]);
  const [bootstrapLoaded, setBootstrapLoaded] = useState(false);

  // 防止重复请求的 ref
  const bootstrapFetchedRef = useRef(false);

  // ============ 获取 Bootstrap 数据（分类+统计+热门帖+标签，单次请求）============
  useEffect(() => {
    if (bootstrapFetchedRef.current) return;
    bootstrapFetchedRef.current = true;

    const fetchBootstrap = async () => {
      // 1. 先尝试从 localStorage 读取缓存，实现秒开
      try {
        const cached = localStorage.getItem(BOOTSTRAP_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < BOOTSTRAP_CACHE_TTL) {
            setCategories(data.categories || []);
            setStats(data.stats || { totalPosts: 0, totalUsers: 0, todayPosts: 0 });
            setHotPosts(data.hotPosts || []);
            setSidebarTags(data.tags || []);
            setBootstrapLoaded(true);
          }
        }
      } catch {
        // localStorage 读取失败，忽略
      }

      // 2. 发起 API 请求获取最新数据
      try {
        const res = await fetchWithRetry('/api/forum/bootstrap', {
          timeout: 10000,
          maxRetries: 2,
        });

        if (res.ok) {
          const data: BootstrapData = await res.json();

          setCategories(
            (data.categories || []).map((cat) => ({
              id: String(cat.id),
              name: cat.name,
              slug: cat.slug || '',
              icon: cat.icon || '',
              postCount: cat.postCount || 0,
            })),
          );

          setStats(data.stats || { totalPosts: 0, totalUsers: 0, todayPosts: 0 });

          // 格式化热门帖子
          const formattedHotPosts: Post[] = (data.hotPosts || []).map((p: any) => ({
            id: String(p.id),
            title: p.title,
            content: p.summary || p.content,
            author: { username: p.author?.username || '匿名', avatar: p.author?.avatar || null },
            category: p.category?.slug || '',
            viewCount: p.viewCount || 0,
            likeCount: p.likeCount || 0,
            commentCount: p.commentCount || 0,
            isPinned: p.isPinned,
            isEssence: p.isEssence,
            createdAt: p.createdAt,
            postType: p.postType,
            isAIGenerated: p.isAIGenerated,
          }));
          setHotPosts(formattedHotPosts);

          setSidebarTags(
            (data.tags || []).map((t: any) => ({
              id: String(t.id),
              name: t.name,
              slug: t.slug,
              postCount: t.postCount || 0,
            })),
          );

          setBootstrapLoaded(true);

          // 写入 localStorage 缓存
          try {
            localStorage.setItem(
              BOOTSTRAP_CACHE_KEY,
              JSON.stringify({
                data: {
                  categories: data.categories,
                  stats: data.stats,
                  hotPosts: formattedHotPosts,
                  tags: data.tags,
                },
                timestamp: Date.now(),
              }),
            );
          } catch {
            // localStorage 写入失败（可能空间不足），忽略
          }
        }
      } catch (err) {
        console.error('Bootstrap 请求失败:', err);
        // Bootstrap 失败不影响帖子列表加载，使用空值
        setBootstrapLoaded(true);
      }
    };

    fetchBootstrap();
  }, []);

  // ============ 获取帖子列表（带重试）============
  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      setLoadError(false);

      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: '20',
        });
        if (currentCategory !== 'all') {
          params.set('category', currentCategory);
        }
        if (searchQuery) {
          params.set('search', searchQuery);
        }
        if (tagFilter) {
          params.set('tag', tagFilter);
        }

        let url = '/api/forum/posts';
        if (activeTab === 'following') {
          url = '/api/forum/feed';
        } else if (activeTab === 'question') {
          params.set('postType', 'question');
        } else if (activeTab === 'discussion') {
          params.set('postType', 'discussion');
        }

        const res = await fetchWithRetry(`${url}?${params}`, {
          timeout: 10000,
          maxRetries: 2,
        });

        if (res.ok) {
          const data = await res.json();
          const formattedPosts: Post[] = (data.posts || []).map((p: any) => ({
            id: String(p.id),
            title: p.title,
            content: p.summary || p.content,
            author: { username: p.author?.username || '匿名', avatar: p.author?.avatar || null },
            category: p.category?.slug || '',
            viewCount: p.viewCount || 0,
            likeCount: p.likeCount || 0,
            commentCount: p.commentCount || 0,
            isPinned: p.isPinned,
            isEssence: p.isEssence,
            createdAt: p.createdAt,
            postType: p.postType,
            isAIGenerated: p.isAIGenerated,
            tags: p.tags,
          }));
          setPosts(formattedPosts);
          setTotalPages(data.totalPages || 1);
          setStats((prev) => ({
            ...prev,
            totalPosts: data.total || prev.totalPosts,
          }));
          setLoadError(false);
          setRetryCount(0);
        } else if (res.status === 401 && activeTab === 'following') {
          setPosts([]);
          setTotalPages(1);
        } else if (res.status === 503) {
          const errorData = await res.json().catch(() => ({}));
          console.error('数据库错误:', errorData);
          setLoadError(true);
          setPosts([]);
        } else {
          console.error('API 返回错误:', res.status);
          setLoadError(true);
          setPosts([]);
        }
      } catch (err) {
        console.error('获取帖子失败:', err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [currentPage, currentCategory, searchQuery, tagFilter, activeTab]);

  // 手动重试
  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
    setLoading(true);
    setLoadError(false);
    // 触发重新获取
    const params = new URLSearchParams({ page: String(currentPage), limit: '20' });
    if (currentCategory !== 'all') params.set('category', currentCategory);
    if (searchQuery) params.set('search', searchQuery);
    if (tagFilter) params.set('tag', tagFilter);

    let url = '/api/forum/posts';
    if (activeTab === 'following') {
      url = '/api/forum/feed';
    } else if (activeTab === 'question') {
      params.set('postType', 'question');
    } else if (activeTab === 'discussion') {
      params.set('postType', 'discussion');
    }

    fetchWithRetry(`${url}?${params}`, { timeout: 10000, maxRetries: 3 })
      .then((res) => res.json())
      .then((data) => {
        const formattedPosts: Post[] = (data.posts || []).map((p: any) => ({
          id: String(p.id),
          title: p.title,
          content: p.summary || p.content,
          author: { username: p.author?.username || '匿名', avatar: p.author?.avatar || null },
          category: p.category?.slug || '',
          viewCount: p.viewCount || 0,
          likeCount: p.likeCount || 0,
          commentCount: p.commentCount || 0,
          isPinned: p.isPinned,
          isEssence: p.isEssence,
          createdAt: p.createdAt,
          postType: p.postType,
          isAIGenerated: p.isAIGenerated,
          tags: p.tags,
        }));
        setPosts(formattedPosts);
        setTotalPages(data.totalPages || 1);
        setLoadError(false);
        setRetryCount(0);
      })
      .catch((err) => {
        console.error('重试获取帖子失败:', err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [currentPage, currentCategory, searchQuery, tagFilter, activeTab]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategoryChange = (category: string) => {
    setCurrentCategory(category);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  // Tab 配置 — 去掉 emoji
  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'discussion', label: '讨论' },
    { key: 'question', label: '问答' },
    ...(user ? [{ key: 'following' as TabType, label: '关注' }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero 头部 */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900 text-white">
        <Container className="py-6 sm:py-10">
          {/* 面包屑 + 标题 */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <Link href="/" className="hover:text-white transition-colors">
              首页
            </Link>
            <span>/</span>
            <span className="text-gray-300">社区</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                开发者社区
              </h1>
              <p className="text-sm text-gray-400 mt-1.5">
                技术交流 · 工具反馈 · 经验分享
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Link
                    href="/forum/new?type=question"
                    className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium text-white/90 border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <QuestionIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">提问</span>
                  </Link>
                  <Link
                    href="/forum/new"
                    className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium text-gray-900 bg-white rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    发帖
                  </Link>
                </>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-900 bg-white rounded-lg hover:bg-gray-100 transition-colors"
                >
                  登录后发帖
                </Link>
              )}
            </div>
          </div>

          {/* 统计数据条 */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-bold text-white">{stats.totalPosts}</span>
              <span className="text-gray-400">帖子</span>
            </div>
            <div className="w-px h-8 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-bold text-white">{stats.totalUsers}</span>
              <span className="text-gray-400">用户</span>
            </div>
            <div className="w-px h-8 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-bold text-indigo-400">{stats.todayPosts}</span>
              <span className="text-gray-400">今日新增</span>
            </div>
          </div>
        </Container>
      </div>

      {/* Tab 切换栏 — 下划线风格 */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-30 dark:bg-slate-800 dark:border-slate-700">
        <Container className="px-0 sm:px-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-4 sm:px-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "relative px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                  activeTab === tab.key
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
                )}
              >
                {tab.label}
                {/* 下划线指示器 */}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </Container>
      </div>

      {/* 主内容区 */}
      <Container className="py-6">
        {/* 标签筛选提示 */}
        {tagFilter && (
          <div className="flex items-center gap-2 mb-4 text-sm">
            <span className="text-gray-500">当前标签:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-full">
              {tagFilter}
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.delete('tag');
                  router.replace(`/forum${params.toString() ? `?${params}` : ''}`);
                }}
                className="text-indigo-400 hover:text-indigo-600 ml-0.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </div>
        )}

        {/* 关注 Tab 未登录提示 */}
        {activeTab === 'following' && !user && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-50 rounded-full mb-3">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 mb-1">登录后查看关注动态</p>
            <p className="text-xs text-gray-400 mb-4">关注其他用户，实时获取他们的最新帖子</p>
            <Link
              href="/login"
              className="inline-block px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
            >
              去登录
            </Link>
          </div>
        )}

        {/* 关注 Tab 已登录但无内容提示 */}
        {activeTab === 'following' && user && !loading && posts.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-50 rounded-full mb-3">
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 mb-1">还没有关注的动态</p>
            <p className="text-xs text-gray-400">关注其他用户或分类后，这里会显示他们的最新帖子</p>
          </div>
        )}

        {/* 主内容区：帖子列表 + 侧边栏 */}
        {!(activeTab === 'following' && (!user || (!loading && posts.length === 0))) && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* 左侧帖子列表 */}
            <div className="w-full lg:w-2/3 min-w-0">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse"
                    >
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-7 h-7 bg-gray-100 rounded-full" />
                        <div className="h-3 bg-gray-100 rounded w-20" />
                        <div className="h-3 bg-gray-100 rounded w-12" />
                        <div className="ml-auto h-3 bg-gray-100 rounded w-10" />
                      </div>
                      <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-gray-50 rounded w-full mb-1.5" />
                      <div className="h-3 bg-gray-50 rounded w-2/3 mb-3" />
                      <div className="flex gap-4">
                        <div className="h-3 bg-gray-50 rounded w-8" />
                        <div className="h-3 bg-gray-50 rounded w-8" />
                        <div className="h-3 bg-gray-50 rounded w-8" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : loadError && posts.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-red-50 rounded-full mb-3">
                    <RefreshIcon className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-sm text-gray-500 mb-1">数据加载超时</p>
                  <p className="text-xs text-gray-400 mb-4">
                    {retryCount > 0 ? `已重试 ${retryCount} 次，请稍后再试` : '请检查网络后重试'}
                  </p>
                  <button
                    onClick={handleRetry}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
                  >
                    <RefreshIcon className="w-4 h-4" />
                    重新加载
                  </button>
                </div>
              ) : (
                <PostList
                  posts={posts}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  onCategoryChange={handleCategoryChange}
                  currentCategory={currentCategory}
                  categories={categories}
                  searchQuery={searchQuery}
                  onSearchChange={handleSearchChange}
                />
              )}
            </div>

            {/* 右侧侧边栏 */}
            <div className="w-full lg:w-1/3 lg:min-w-0">
              <div className="lg:sticky lg:top-28">
                <Sidebar stats={stats} hotPosts={hotPosts} tags={sidebarTags} />
              </div>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
