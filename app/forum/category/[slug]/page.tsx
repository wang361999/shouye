'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import PostList from '@/components/forum/PostList';
import Sidebar from '@/components/forum/Sidebar';
import { useAppStore } from '@/lib/store';

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
}

export default function CategoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const router = useRouter();
  const { user } = useAppStore();

  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [currentCategory, setCurrentCategory] = useState(slug);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [categoryName, setCategoryName] = useState('');

  // 热门帖子 & 统计数据
  const [hotPosts, setHotPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState({ totalPosts: 0, totalUsers: 0, todayPosts: 0 });

  // 获取分类列表
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/forum/categories');
        if (res.ok) {
          const data = await res.json();
          const cats: Category[] = data.map((cat: any) => ({
            id: String(cat.id),
            name: cat.name,
            slug: cat.slug || '',
            icon: cat.icon || '',
            postCount: cat.postCount || 0,
          }));
          setCategories(cats);

          // 找到当前分类名
          const current = data.find((cat: any) => cat.slug === slug);
          if (current) {
            setCategoryName(current.name);
          }
          setCurrentCategory(slug);
        }
      } catch (err) {
        console.error('获取分类失败:', err);
      }
    };
    fetchCategories();
  }, [slug]);

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
          category: slug,
        });
        if (searchQuery) {
          params.set('search', searchQuery);
        }
        const res = await fetch(`/api/forum/posts?${params}`);
        if (res.ok) {
          const data = await res.json();
          const formattedPosts: Post[] = data.posts.map((p: any) => ({
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
          setPosts(formattedPosts);
          setTotalPages(data.totalPages || 1);
          setStats((prev) => ({ ...prev, totalPosts: data.total || prev.totalPosts }));
        }
      } catch (err) {
        console.error('获取帖子失败:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [currentPage, slug, searchQuery]);

  // 获取热门帖子（服务端排序）
  const fetchHotPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/forum/posts?limit=5&sort=hot');
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

  // 分类切换：导航到对应分类页
  const handleCategoryChange = (category: string) => {
    if (category === 'all') {
      router.push('/forum');
    } else {
      router.push(`/forum/category/${category}`);
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  return (
    <Container className="py-8">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between mb-2">
        <Link
          href="/forum"
          className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          &larr; 返回论坛
        </Link>
        {user ? (
          <Link
            href="/forum/new"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 发布新帖
          </Link>
        ) : (
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          >
            登录后发帖
          </Link>
        )}
      </div>

      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        💬 社区论坛
      </h1>
      <p className="text-sm text-blue-600 font-medium mb-8">
        分类：{categoryName || slug}
      </p>

      {/* 主内容区：帖子列表 + 侧边栏 */}
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
    </Container>
  );
}
