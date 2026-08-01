'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import PostList from '@/components/forum/PostList';
import Sidebar from '@/components/forum/Sidebar';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

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
  tags?: { tag: { id: string; name: string; slug: string } }[];
}

interface ForumStats {
  totalPosts: number;
  totalUsers: number;
  todayPosts: number;
}

type TabType = 'all' | 'discussion' | 'question' | 'following';

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

  // 从 URL 获取标签参数
  const tagFilter = searchParams.get('tag') || '';

  // 热门帖子 & 统计数据
  const [hotPosts, setHotPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<ForumStats>({
    totalPosts: 0,
    totalUsers: 0,
    todayPosts: 0,
  });

  // 获取分类列表
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/forum/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(
            data.map((cat: any) => ({
              id: String(cat.id),
              name: cat.name,
              slug: cat.slug || '',
              icon: cat.icon || '',
              postCount: cat.postCount || 0,
            }))
          );
        }
      } catch (err) {
        console.error('获取分类失败:', err);
      }
    };
    fetchCategories();
  }, []);

  // 获取统计数据
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          setStats((prev) => ({
            totalPosts: data.postCount ?? prev.totalPosts,
            totalUsers: data.userCount ?? 0,
            todayPosts: prev.todayPosts,
          }));
        }
      } catch (err) {
        console.error('获取统计数据失败:', err);
      }
    };
    fetchStats();
  }, []);

  // 获取帖子列表
  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
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

        // 根据当前 Tab 选择 API
        let url = '/api/forum/posts';
        if (activeTab === 'following') {
          url = '/api/forum/feed';
        } else if (activeTab === 'question') {
          params.set('postType', 'question');
        } else if (activeTab === 'discussion') {
          params.set('postType', 'discussion');
        }

        const res = await fetch(`${url}?${params}`, {
          signal: AbortSignal.timeout(8000),
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
            tags: p.tags,
          }));
          setPosts(formattedPosts);
          setTotalPages(data.totalPages || 1);
          setStats((prev) => ({
            ...prev,
            totalPosts: data.total || prev.totalPosts,
          }));
        } else if (res.status === 401 && activeTab === 'following') {
          // 未登录时关注 Tab 返回空
          setPosts([]);
          setTotalPages(1);
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

  // 获取热门帖子
  const fetchHotPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/forum/posts?limit=5&sort=hot', {
          signal: AbortSignal.timeout(8000),
        });
      if (res.ok) {
        const data = await res.json();
        const formatted: Post[] = data.posts.map((p: any) => ({
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
        }));
        setHotPosts(formatted);
      }
    } catch (err) {
      console.error('获取热门帖子失败:', err);
    }
  }, []);

  useEffect(() => {
    fetchHotPosts();
  }, [fetchHotPosts]);

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

  // Tab 配置
  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'all', label: '全部', icon: '📋' },
    { key: 'discussion', label: '讨论', icon: '💬' },
    { key: 'question', label: '问答', icon: '❓' },
    ...(user ? [{ key: 'following' as TabType, label: '关注', icon: '🔔' }] : []),
  ];

  return (
    <Container className="py-8">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between mb-2">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          &larr; 返回首页
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/forum/new?type=question"
                className="px-3 py-2 text-sm font-medium text-green-600 border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
              >
                ❓ 提问
              </Link>
              <Link
                href="/forum/new"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + 发帖
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            >
              登录后发帖
            </Link>
          )}
        </div>
      </div>

      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        💬 社区论坛
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        开发者交流 · 工具反馈 · 经验分享
      </p>

      {/* Tab 切换栏 */}
      <div className="flex items-center gap-1 mb-4 bg-white rounded-xl border border-gray-200 p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
              activeTab === tab.key
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 标签筛选提示 */}
      {tagFilter && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="text-gray-500">当前标签:</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-full">
            🏷️ {tagFilter}
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.delete('tag');
                router.replace(`/forum${params.toString() ? `?${params}` : ''}`);
              }}
              className="text-blue-400 hover:text-blue-600"
            >
              ✕
            </button>
          </span>
        </div>
      )}

      {/* 关注 Tab 未登录提示 */}
      {activeTab === 'following' && !user && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-sm text-gray-500 mb-4">登录后查看关注动态</p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            去登录
          </Link>
        </div>
      )}

      {/* 关注 Tab 已登录但无内容提示 */}
      {activeTab === 'following' && user && !loading && posts.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm text-gray-500 mb-2">还没有关注的动态</p>
          <p className="text-xs text-gray-400">关注其他用户或分类后，这里会显示他们的最新帖子</p>
        </div>
      )}

      {/* 主内容区：帖子列表 + 侧边栏 */}
      {!(activeTab === 'following' && (!user || (!loading && posts.length === 0))) && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 左侧帖子列表 (2/3) */}
          <div className="w-full lg:w-2/3">
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
                        <div className="h-3 bg-gray-100 rounded w-1/3" />
                      </div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-3" />
                    <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : loadError && posts.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <p className="text-4xl mb-3">😵</p>
                <p className="text-gray-500 mb-4">数据加载超时，请检查网络后重试</p>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
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

          {/* 右侧侧边栏 (1/3) */}
          <div className="w-full lg:w-1/3">
            <Sidebar stats={stats} hotPosts={hotPosts} />
          </div>
        </div>
      )}
    </Container>
  );
}
