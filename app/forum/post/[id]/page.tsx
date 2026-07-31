'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import CommentList from '@/components/forum/CommentList';
import { useAppStore } from '@/lib/store';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Post {
  id: string;
  title: string;
  content: string;
  author: { username: string };
  category: { id: string; name: string; slug: string };
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isEssence: boolean;
  isLocked: boolean;
  createdAt: string;
  comments: any[];
}

export default function PostDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();
  const { token } = useAppStore();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);

  // 获取帖子详情
  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/forum/posts/${id}`);
        if (!res.ok) {
          throw new Error('帖子不存在');
        }
        const data = await res.json();
        setPost({
          ...data,
          id: String(data.id),
          category: data.category || { id: '', name: '未分类', slug: '' },
        });
      } catch (err: any) {
        toast.error(err.message || '获取帖子失败');
        router.replace('/forum');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id, router]);

  // 点赞
  const handleLike = async () => {
    if (!token) {
      toast.error('请先登录');
      return;
    }
    try {
      const res = await fetch('/api/forum/interact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId: id, action: 'like' }),
      });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setPost((prev) =>
          prev
            ? {
                ...prev,
                likeCount: data.liked
                  ? prev.likeCount + 1
                  : Math.max(0, prev.likeCount - 1),
              }
            : prev
        );
        toast.success(data.liked ? '已点赞' : '已取消点赞');
      }
    } catch (err) {
      toast.error('操作失败');
    }
  };

  // 收藏
  const handleFavorite = async () => {
    if (!token) {
      toast.error('请先登录');
      return;
    }
    try {
      const res = await fetch('/api/forum/interact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId: id, action: 'favorite' }),
      });
      if (res.ok) {
        const data = await res.json();
        setFavorited(data.favorited);
        toast.success(data.favorited ? '已收藏' : '已取消收藏');
      }
    } catch (err) {
      toast.error('操作失败');
    }
  };

  // 分享（复制链接）
  const handleShare = () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        toast.success('链接已复制到剪贴板');
      });
    } else {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success('链接已复制到剪贴板');
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  if (loading) {
    return (
      <Container className="py-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </Container>
    );
  }

  if (!post) {
    return (
      <Container className="py-16 text-center">
        <p className="text-gray-500">帖子不存在</p>
      </Container>
    );
  }

  return (
    <Container className="py-8 max-w-4xl">
      {/* 返回链接 */}
      <Link
        href="/forum"
        className="inline-block text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
      >
        &larr; 返回列表
      </Link>

      {/* 帖子标题 */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
        {post.isPinned && (
          <span className="text-red-500 mr-2">📌</span>
        )}
        {post.isEssence && (
          <span className="text-orange-500 mr-2">⭐</span>
        )}
        {post.title}
      </h1>

      {/* 帖子元信息 */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mb-6">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
          {post.category.name}
        </span>
        <span>{post.author.username}</span>
        <span>·</span>
        <span>{formatDate(post.createdAt)}</span>
        <span>·</span>
        <span>👁 {post.viewCount} 次浏览</span>
      </div>

      {/* 分割线 */}
      <hr className="border-gray-200 mb-6" />

      {/* 帖子正文 - Markdown 渲染 */}
      <div className="prose prose-sm sm:prose-base max-w-none mb-6 markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.content}
        </ReactMarkdown>
      </div>

      {/* 分割线 */}
      <hr className="border-gray-200 mb-6" />

      {/* 操作按钮行 */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* 点赞 */}
        <button
          onClick={handleLike}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
            liked
              ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          {liked ? '❤️' : '🤍'} 点赞({post.likeCount})
        </button>

        {/* 评论 */}
        <button
          onClick={() => {
            document.getElementById('comment-section')?.scrollIntoView({
              behavior: 'smooth',
            });
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
        >
          💬 评论({post.commentCount})
        </button>

        {/* 收藏 */}
        <button
          onClick={handleFavorite}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
            favorited
              ? 'bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-100'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          {favorited ? '⭐' : '☆'} 收藏
        </button>

        {/* 分享 */}
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
        >
          🔗 分享
        </button>
      </div>

      {/* 分割线 */}
      <hr className="border-gray-200 mb-6" />

      {/* 评论区 */}
      <div id="comment-section">
        <CommentList
          comments={post.comments || []}
          postId={id}
        />
      </div>
    </Container>
  );
}
