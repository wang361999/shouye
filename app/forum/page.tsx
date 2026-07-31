'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import PostList from '@/components/forum/PostList';
import Sidebar from '@/components/forum/Sidebar';
import { useAppStore } from '@/lib/store';

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: { username: string };
  category: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isEssence: boolean;
  createdAt: string;
}

export default function ForumPage() {
  const { user } = useAppStore();

  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [currentCategory, setCurrentCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

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
          setCategories(
            data.map((cat: any) => ({
              id: String(cat.id),
              name: cat.name,
              icon: cat.icon || '',
            }))
          );
        }
      } catch (err) {
        console.error('获取分类失败:', err);
      }
    };
    fetchCategories();
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
        const res = await fetch(`/api/forum/posts?${params}`);
        if (res.ok) {
          const data = await res.json();
          // 转换数据格式以匹配 PostList 组件的接口
          const formattedPosts = data.posts.map((p: any) => ({
            id: String(p.id),
            title: p.title,
            content: p.summary || p.content,
            author: { username: p.author?.username || '匿名' },
            category: p.category?.slug || '',
            viewCount: p.viewCount,
            likeCount: p.likeCount,
            commentCount: p.commentCount,
            isPinned: p.isPinned,
            isEssence: p.isEssence,
            createdAt: p.createdAt,
          }));
          setPosts(formattedPosts);
          setTotalPages(data.totalPages || 1);

          // 从 total 计算统计数据
          setStats((prev) => ({ ...prev, totalPosts: data.total || prev.totalPosts }));
        }
      } catch (err) {
        console.error('获取帖子失败:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [currentPage, currentCategory, searchQuery]);

  // 获取热门帖子
  useEffect(() => {
    const fetchHotPosts = async () => {
      try {
        const res = await fetch('/api/forum/posts?limit=100');
        if (res.ok) {
          const data = await res.json();
          const sorted = [...data.posts]
            .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
            .slice(0, 5)
            .map((p: any) => ({
              id: String(p.id),
              title: p.title,
              content: p.summary || p.content,
              author: { username: p.author?.username || '匿名' },
              category: p.category?.slug || '',
              viewCount: p.viewCount,
              likeCount: p.likeCount,
              commentCount: p.commentCount,
              isPinned: p.isPinned,
              isEssence: p.isEssence,
              createdAt: p.createdAt,
            }));
          setHotPosts(sorted);
        }
      } catch (err) {
        console.error('获取热门帖子失败:', err);
      }
    };
    fetchHotPosts();
  }, []);

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
        {user ? (
          <Link
            href="/forum/new"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 发布新帖
          </Link>
        ) : (
          <Link
            href="/admin/login"
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
      <p className="text-sm text-gray-500 mb-8">
        开发者交流 · 工具反馈 · 经验分享
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
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-3" />
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
