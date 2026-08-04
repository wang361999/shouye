'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import UserAvatar from '@/components/common/UserAvatar';
import CommentList from '@/components/forum/CommentList';
import MarkdownRenderer from '@/components/forum/MarkdownRenderer';
import { ReputationBadge, FollowButton } from '@/components/forum/ReputationBadge';
import { useAppStore } from '@/lib/store';
import toast from 'react-hot-toast';

interface PostTag {
  tag: { id: string; name: string; slug: string };
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: { id: string; username: string; avatar?: string | null; reputation?: number; badge?: string | null };
  category: { id: string; name: string; slug: string };
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPinned: boolean;
  isEssence: boolean;
  isLocked: boolean;
  postType: string;
  acceptedCommentId: string | null;
  isAIGenerated?: boolean;
  tags?: PostTag[];
  createdAt: string;
  comments: any[];
}

const fallbackAuthor = {
  id: "",
  username: "未知用户",
  avatar: null,
  reputation: 0,
  badge: null,
};

const fallbackCategory = {
  id: "",
  name: "未分类",
  slug: "",
};

function normalizePost(data: any): Post {
  const author = data?.author && typeof data.author === "object"
    ? {
        ...fallbackAuthor,
        ...data.author,
        id: String(data.author.id || ""),
        username: data.author.username || "未知用户",
      }
    : fallbackAuthor;

  const category = data?.category && typeof data.category === "object"
    ? {
        ...fallbackCategory,
        ...data.category,
        id: String(data.category.id || ""),
        name: data.category.name || "未分类",
        slug: data.category.slug || "",
      }
    : fallbackCategory;

  return {
    id: String(data?.id || ""),
    title: data?.title || "无标题帖子",
    content: typeof data?.content === "string" ? data.content : "",
    author,
    category,
    viewCount: Number(data?.viewCount || 0),
    likeCount: Number(data?.likeCount || 0),
    commentCount: Number(data?.commentCount || 0),
    isPinned: Boolean(data?.isPinned),
    isEssence: Boolean(data?.isEssence),
    isLocked: Boolean(data?.isLocked),
    postType: data?.postType === "question" ? "question" : "discussion",
    acceptedCommentId: data?.acceptedCommentId || null,
    isAIGenerated: Boolean(data?.isAIGenerated),
    tags: Array.isArray(data?.tags)
      ? data.tags.filter((item: any) => item?.tag && typeof item.tag === "object")
      : [],
    createdAt: data?.createdAt || new Date().toISOString(),
    comments: Array.isArray(data?.comments) ? data.comments : [],
  };
}

export default function PostDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();
  const { token, user } = useAppStore();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // 获取帖子详情
  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/forum/posts/${id}`);
        if (!res.ok) {
          throw new Error('帖子不存在');
        }
        const data = await res.json();
        setPost(normalizePost(data));
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

  // 分享
  const handleShare = () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        toast.success('链接已复制到剪贴板');
      });
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success('链接已复制到剪贴板');
    }
  };

  // 删除帖子
  const handleDelete = async () => {
    if (!token) {
      toast.error('请先登录');
      return;
    }
    if (!confirm('确定要删除这篇帖子吗？删除后无法恢复。')) {
      return;
    }
    try {
      const res = await fetch(`/api/forum/posts/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        toast.success('帖子已删除');
        router.push('/forum');
      } else {
        const errData = await res.json();
        toast.error(errData.error || '删除失败');
      }
    } catch (err) {
      toast.error('删除帖子失败');
    }
  };

  // 举报帖子
  const handleReport = async (reason: string, description: string) => {
    if (!token) {
      toast.error('请先登录');
      return;
    }
    try {
      const res = await fetch('/api/forum/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: 'post',
          targetId: id,
          reason,
          description: description || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '举报失败');
        return;
      }
      toast.success('举报已提交，管理员将尽快处理');
      setShowReportModal(false);
    } catch {
      toast.error('网络错误，请稍后重试');
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

  const isQuestion = post.postType === 'question';

  return (
    <Container className="py-8 max-w-4xl">
      {/* 返回链接 */}
      <Link
        href="/forum"
        className="inline-block text-[11px] sm:text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
      >
        &larr; 返回列表
      </Link>

      {/* 帖子标题 */}
      <h1 className="text-[21px] sm:text-3xl font-bold leading-[1.32] text-gray-900 mb-3">
        {post.isPinned && (
          <span className="text-red-500 mr-2">📌</span>
        )}
        {post.isEssence && (
          <span className="text-orange-500 mr-2">⭐</span>
        )}
        {post.title}
      </h1>

      {/* 帖子元信息 */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-sm text-gray-500 mb-4">
        <UserAvatar username={post.author.username} avatar={post.author.avatar} size="sm" />
        <span className="font-medium text-gray-700">{post.author.username}</span>
        {post.author.reputation !== undefined && (
          <ReputationBadge reputation={post.author.reputation} badge={post.author.badge} size="xs" />
        )}
        <span>·</span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] sm:text-sm font-medium">
          {post.category.name}
        </span>
        {/* 帖子类型标识 */}
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] sm:text-sm font-medium border ${
          isQuestion
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-gray-50 text-gray-600 border-gray-200'
        }`}>
          {isQuestion ? '❓ 问答' : '💬 讨论'}
        </span>

        {/* AI 创作标识 */}
        {post.isAIGenerated && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] sm:text-sm font-medium border bg-violet-50 text-violet-700 border-violet-200">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI 创作
          </span>
        )}
        <span>·</span>
        <span>{formatDate(post.createdAt)}</span>
        <span>·</span>
        <span>👁 {post.viewCount} 次浏览</span>
      </div>

      {/* 标签展示 */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {post.tags.map(({ tag }) => (
            <Link
              key={tag.id}
              href={`/forum?tag=${encodeURIComponent(tag.slug)}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] sm:text-sm font-medium bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
            >
              🏷️ {tag.name}
            </Link>
          ))}
        </div>
      )}

      {/* 分割线 */}
      <hr className="border-gray-200 mb-6" />

      {/* 帖子正文 - Markdown 渲染（统一代码块样式：macOS 风格 + 语言标签 + 复制按钮） */}
      <MarkdownRenderer content={post.content} className="mb-6 text-[13px] sm:text-base" />

      {/* 分割线 */}
      <hr className="border-gray-200 mb-6" />

      {/* 操作按钮行 */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* 点赞 */}
        <button
          onClick={handleLike}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-[13px] sm:text-base font-medium rounded-lg border transition-colors ${
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
          className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] sm:text-base font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
        >
          💬 {isQuestion ? '回答' : '评论'}({post.commentCount})
        </button>

        {/* 收藏 */}
        <button
          onClick={handleFavorite}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-[13px] sm:text-base font-medium rounded-lg border transition-colors ${
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
          className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] sm:text-base font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
        >
          🔗 分享
        </button>

        {/* 关注作者 */}
        {user && post.author.id !== user.id && (
          <FollowButton targetId={post.author.id} targetType="user" size="sm" />
        )}

        {/* 举报 */}
        {user && post.author.id !== user.id && (
          <button
            onClick={() => setShowReportModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] sm:text-base font-medium rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-orange-500 hover:border-orange-200 transition-colors"
          >
            🚩 举报
          </button>
        )}

        {/* 编辑（仅作者或管理员可见） */}
        {user && (post.author.id === user.id || user.role === 'ADMIN') && (
          <>
            <Link
              href={`/forum/post/${id}/edit`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] sm:text-base font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            >
              ✏️ 编辑
            </Link>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] sm:text-base font-medium rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              🗑️ 删除
            </button>
          </>
        )}
      </div>

      {/* 问答帖采纳提示 */}
      {isQuestion && post.acceptedCommentId && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-[11px] sm:text-sm text-green-700 flex items-center gap-2">
            ✓ 该问题已有采纳答案，请查看下方标记为「已采纳」的回答
          </p>
        </div>
      )}

      {/* 举报弹窗 */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">🚩 举报帖子</h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <ReportForm onSubmit={handleReport} onCancel={() => setShowReportModal(false)} />
          </div>
        </div>
      )}

      {/* 分割线 */}
      <hr className="border-gray-200 mb-6" />

      {/* 评论区 */}
      <div id="comment-section">
        <CommentList
          comments={post.comments || []}
          postId={id}
          postAuthorId={post.author.id}
          postType={post.postType}
          acceptedCommentId={post.acceptedCommentId}
        />
      </div>
    </Container>
  );
}

// 举报表单组件
function ReportForm({ onSubmit, onCancel }: { onSubmit: (reason: string, description: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  const reasons = [
    { value: "spam", label: "垃圾广告 / 推广", icon: "📢" },
    { value: "abuse", label: "辱骂 / 人身攻击", icon: "💢" },
    { value: "inappropriate", label: "不当内容", icon: "⚠️" },
    { value: "other", label: "其他", icon: "📋" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {reasons.map((r) => (
          <button
            key={r.value}
            onClick={() => setReason(r.value)}
            className={`flex items-center gap-2 px-3 py-2.5 text-[13px] sm:text-base font-medium rounded-lg border transition-colors text-left ${
              reason === r.value
                ? "bg-orange-50 text-orange-600 border-orange-300"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span className="text-[15px]">{r.icon}</span>
            <span>{r.label}</span>
          </button>
        ))}
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="补充说明（可选）"
        rows={3}
        className="w-full px-3 py-2 text-[16px] sm:text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-[13px] sm:text-base font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
        <button
          onClick={() => reason && onSubmit(reason, description)}
          disabled={!reason}
          className={`px-4 py-2 text-[13px] sm:text-base font-medium rounded-lg transition-colors ${
            reason
              ? "text-white bg-orange-500 hover:bg-orange-600"
              : "text-gray-300 bg-gray-200 cursor-not-allowed"
          }`}
        >
          提交举报
        </button>
      </div>
    </div>
  );
}
