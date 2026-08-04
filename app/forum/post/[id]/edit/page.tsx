'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import PostForm from '@/components/forum/PostForm';
import { useAppStore } from '@/lib/store';
import toast from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface PostData {
  id: string;
  title: string;
  content: string;
  category: string;
  author: { username: string };
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isEssence: boolean;
  createdAt: string;
}

export default function EditPostPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();
  const { user, token } = useAppStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [initialData, setInitialData] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  // 未登录时重定向到登录页
  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  // 获取帖子详情
  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/forum/posts/${id}`);
        if (!res.ok) {
          throw new Error('帖子不存在');
        }
        const data = await res.json();

        // 权限检查：作者本人或管理员
        if (data.authorId !== user?.id && user?.role !== 'ADMIN') {
          setForbidden(true);
          toast.error('无权编辑此帖子');
          return;
        }

        setInitialData({
          id: String(data.id),
          title: data.title,
          content: data.content,
          category: data.category ? String(data.category.id) : '',
          author: data.author,
          viewCount: data.viewCount,
          likeCount: data.likeCount,
          commentCount: data.commentCount,
          isPinned: data.isPinned,
          isEssence: data.isEssence,
          createdAt: data.createdAt,
        });
      } catch (err: any) {
        toast.error(err.message || '获取帖子失败');
        router.replace('/forum');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchPost();
    }
  }, [id, user, router]);

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

  const handleSubmit = async (data: {
    title: string;
    category: string;
    content: string;
  }) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/forum/posts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          categoryId: data.category || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '保存失败');
      }

      toast.success('帖子修改成功！');
      router.push(`/forum/post/${id}`);
    } catch (err: any) {
      toast.error(err.message || '编辑帖子失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <Container className="py-16 text-center">
        <p className="text-gray-500">正在跳转到登录页...</p>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container className="py-4 sm:py-8 max-w-3xl">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </Container>
    );
  }

  if (forbidden) {
    return (
      <Container className="py-16 text-center">
        <p className="text-gray-500 mb-4">您无权编辑此帖子</p>
        <Link
          href={`/forum/post/${id}`}
          className="text-blue-600 hover:underline text-sm"
        >
          返回帖子
        </Link>
      </Container>
    );
  }

  if (!initialData) {
    return (
      <Container className="py-16 text-center">
        <p className="text-gray-500">帖子不存在</p>
      </Container>
    );
  }

  return (
    <Container className="py-4 sm:py-8 max-w-3xl">
      {/* 顶部导航 */}
      <Link
        href={`/forum/post/${id}`}
        className="inline-flex items-center text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4 sm:mb-6 touch-target"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        返回帖子
      </Link>

      {/* 页面标题 */}
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
        ✏️ 编辑帖子
      </h1>

      {/* 编辑表单 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <PostForm
          categories={categories}
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/forum/post/${id}`)}
        />
      </div>

      {/* 提交中提示 */}
      {submitting && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg px-6 py-4 shadow-lg flex items-center gap-3">
            <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-gray-700">正在保存...</p>
          </div>
        </div>
      )}
    </Container>
  );
}
