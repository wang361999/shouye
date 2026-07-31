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

export default function NewPostPage() {
  const router = useRouter();
  const { user, token } = useAppStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 未登录时重定向到登录页
  useEffect(() => {
    if (!user) {
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

  const handleSubmit = async (data: {
    title: string;
    category: string;
    content: string;
  }) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/forum/posts', {
        method: 'POST',
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
        throw new Error(errData.error || '发布失败');
      }

      const post = await res.json();
      toast.success('帖子发布成功！');
      router.push(`/forum/post/${post.id}`);
    } catch (err: any) {
      toast.error(err.message || '发布帖子失败');
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

  return (
    <Container className="py-8 max-w-3xl">
      {/* 顶部导航 */}
      <Link
        href="/forum"
        className="inline-block text-sm text-gray-500 hover:text-blue-600 transition-colors mb-6"
      >
        &larr; 返回论坛
      </Link>

      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        ✏️ 发布新帖
      </h1>

      {/* 发布表单 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <PostForm
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      </div>

      {/* 提交中提示 */}
      {submitting && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg px-6 py-4 shadow-lg">
            <p className="text-gray-700">正在发布...</p>
          </div>
        </div>
      )}
    </Container>
  );
}
