'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import { useAppStore } from '@/lib/store';
import toast from 'react-hot-toast';
import { formatTimeAgo } from '@/lib/utils';

interface CommentWithPost {
  id: string;
  content: string;
  author: { id: number; username: string };
  postId: number;
  post?: {
    id: number;
    title: string;
  };
  createdAt: string;
}

export default function MyCommentsPage() {
  const router = useRouter();
  const { user } = useAppStore();

  const [comments, setComments] = useState<CommentWithPost[]>([]);
  const [loading, setLoading] = useState(true);

  // 未登录时重定向到登录页
  useEffect(() => {
    if (!user) {
      toast.error('请先登录');
      router.replace('/login');
    }
  }, [user, router]);

  // 获取当前用户的评论
  useEffect(() => {
    if (!user) return;

    const fetchComments = async () => {
      setLoading(true);
      try {
        // 当前评论 API 不支持按作者筛选，需要获取所有帖子再过滤
        // 先获取用户的所有帖子
        const postsRes = await fetch(
          `/api/forum/posts?authorId=${user.id}&limit=100`
        );
        if (!postsRes.ok) throw new Error('获取帖子失败');
        const postsData = await postsRes.json();
        const postIds = postsData.posts.map((p: any) => p.id);

        // 对每个帖子获取评论并筛选当前用户的
        const allUserComments: CommentWithPost[] = [];
        for (const postId of postIds) {
          const commentsRes = await fetch(
            `/api/forum/comments?postId=${postId}`
          );
          if (commentsRes.ok) {
            const postComments = await commentsRes.json();
            // 递归收集当前用户的评论
            const collectUserComments = (
              commentList: any[],
              postTitle: string,
              parentPostId: number
            ) => {
              for (const c of commentList) {
                if (c.author && String(c.author.id) === String(user.id)) {
                  allUserComments.push({
                    id: String(c.id),
                    content: c.content,
                    author: c.author,
                    postId: parentPostId,
                    post: { id: parentPostId, title: postTitle },
                    createdAt: c.createdAt,
                  });
                }
                // 检查回复
                if (c.replies && c.replies.length > 0) {
                  collectUserComments(c.replies, postTitle, parentPostId);
                }
              }
            };

            const postData = postsData.posts.find(
              (p: any) => p.id === postId
            );
            collectUserComments(
              postComments,
              postData?.title || '未知帖子',
              postId
            );
          }
        }

        // 按时间降序排列
        allUserComments.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setComments(allUserComments);
      } catch (err) {
        console.error('获取评论失败:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
  }, [user]);

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
          href="/forum/my/posts"
          className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
        >
          我的帖子 &rarr;
        </Link>
      </div>

      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        💬 我的评论
      </h1>

      {/* 评论列表 */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse"
            >
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">💭</p>
          <p className="text-gray-400">
            暂无评论，快去
            <Link href="/forum" className="text-blue-600 hover:underline ml-1">
              论坛
            </Link>
            参与讨论吧
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-sm transition-shadow"
            >
              {/* 评论内容 */}
              <p className="text-sm text-gray-800 leading-relaxed mb-3">
                {comment.content}
              </p>

              {/* 所属帖子 */}
              <div className="flex items-center justify-between">
                <Link
                  href={`/forum/post/${comment.postId}`}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  📄 {comment.post?.title || '查看帖子'}
                </Link>
                <span className="text-xs text-gray-400">
                  {formatTimeAgo(comment.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
