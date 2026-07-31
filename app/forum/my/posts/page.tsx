'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import PostList from '@/components/forum/PostList';
import { useAppStore } from '@/lib/store';
import toast from 'react-hot-toast';

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

export default function MyPostsPage() {
  const router = useRouter();
  const { user } = useAppStore();

  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // 未登录时重定向到登录页
  useEffect(() => {
    if (!user) {
      toast.error('请先登录');
      router.replace('/admin/login');
    }
  }, [user, router]);

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

  // 获取当前用户的帖子
  useEffect(() => {
    if (!user) return;

    const fetchPosts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: '20',
          authorId: String(user.id),
        });
        const res = await fetch(`/api/forum/posts?${params}`);
        if (res.ok) {
          const data = await res.json();
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
        }
      } catch (err) {
        console.error('获取帖子失败:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [user, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 分类筛选在我的帖子页面中不使用（始终按作者筛选）
  const handleCategoryChange = (_category: string) => {
    // 不切换分类，保持作者筛选
  };

  if (!user) {
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
        <Link
          href="/forum/my/comments"
          className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
        >
          我的评论 &rarr;
        </Link>
      </div>

      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        📝 我的帖子
      </h1>

      {/* 帖子列表 */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse"
            >
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
          currentCategory="all"
          categories={categories}
        />
      )}
    </Container>
  );
}
