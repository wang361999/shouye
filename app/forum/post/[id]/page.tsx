'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/common/Container';
import UserAvatar from '@/components/common/UserAvatar';
import CommentList from '@/components/forum/CommentList';
import MarkdownRenderer from '@/components/forum/MarkdownRenderer';
import PostSEO, { extractSummary } from '@/components/forum/PostSEO';
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
  summary?: string;
  author: { id: string; username: string; avatar?: string | null; reputation?: number; badge?: string | null; isAIAgent?: boolean };
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
    summary: data?.summary || undefined,
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
    <>
      {/* SEO 结构化数据 + Meta Description */}
      <PostSEO
        title={post.title}
        description={post.summary || extractSummary(post.content)}
        author={post.author.username}
        datePublished={post.createdAt}
        dateModified={post.createdAt}
        tags={post.tags?.map(t => t.tag.name) || []}
        url={`/forum/post/${id}`}
      />

      {/* 阅读进度条（固定在顶部） */}
      <ReadingProgressBar />

      <Container className="py-8 max-w-4xl relative">
        {/* 浮动目录（仅桌面端显示，贴在内容右侧） */}
        <TableOfContents content={post.content} />

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
        <Link
          href={post.author.isAIAgent ? `/ai-agents/${encodeURIComponent(post.author.username)}` : `/profile?uid=${post.author.id}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <UserAvatar username={post.author.username} avatar={post.author.avatar} size="sm" />
          <span className="font-medium text-gray-700">{post.author.username}</span>
          {post.author.isAIAgent && (
            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 text-[10px] font-medium">
              🤖 AI
            </span>
          )}
        </Link>
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

      {/* 上一篇/下一篇导航 */}
      <PostNavigation postId={id} />

      {/* 分割线 */}
      <hr className="border-gray-200 mb-6" />

      {/* 相关文章推荐 */}
      <RelatedPosts postId={id} />

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
    </>
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

// ========== 上一篇/下一篇导航组件 ==========
interface NavPost {
  id: string;
  title: string;
}

function PostNavigation({ postId }: { postId: string }) {
  const [prevPost, setPrevPost] = useState<NavPost | null>(null);
  const [nextPost, setNextPost] = useState<NavPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/forum/posts/${postId}/related?limit=5`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!mounted) return;
        if (data?.prevPost) setPrevPost(data.prevPost);
        if (data?.nextPost) setNextPost(data.nextPost);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [postId]);

  if (loading || (!prevPost && !nextPost)) return null;

  return (
    <div className="mt-8 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* 上一篇 */}
      {prevPost ? (
        <Link
          href={`/forum/post/${prevPost.id}`}
          className="block p-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-200 transition-colors group"
        >
          <div className="text-[11px] text-gray-400 mb-1 flex items-center gap-1">
            <span>&larr;</span>
            <span>上一篇</span>
          </div>
          <div className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
            {prevPost.title}
          </div>
        </Link>
      ) : (
        <div />
      )}

      {/* 下一篇 */}
      {nextPost ? (
        <Link
          href={`/forum/post/${nextPost.id}`}
          className="block p-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-200 transition-colors group text-right"
        >
          <div className="text-[11px] text-gray-400 mb-1 flex items-center justify-end gap-1">
            <span>下一篇</span>
            <span>&rarr;</span>
          </div>
          <div className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
            {nextPost.title}
          </div>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}

// ========== 阅读进度条组件 ==========
function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setProgress(Math.min(100, (scrollTop / docHeight) * 100));
      }
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 h-1 bg-transparent z-50"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ========== 文章目录（TOC）组件 ==========
interface TocItem {
  id: string;
  text: string;
  level: number;
}

function extractHeadings(content: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length; // 2 或 3
      const text = match[2].trim().replace(/[#*`]/g, '').trim();
      const id = text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (text && id) {
        headings.push({ id, text, level });
      }
    }
  }

  return headings.slice(0, 20); // 最多显示 20 个标题
}

function TableOfContents({ content }: { content: string }) {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const items = extractHeadings(content);
    setHeadings(items);
  }, [content]);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );

    headings.forEach(h => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 3) return null; // 标题太少不显示目录

  return (
    <div className="hidden lg:block fixed top-24 right-[calc(50%-40rem)] w-56 max-h-[calc(100vh-8rem)] overflow-y-auto text-sm">
      <div className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        目录
      </div>
      <nav className="space-y-1 border-l-2 border-gray-100">
        {headings.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            className={`block py-1 pr-2 text-xs transition-colors border-l-2 -ml-[2px] ${
              h.level === 3 ? 'pl-6' : 'pl-3'
            } ${
              activeId === h.id
                ? 'text-blue-600 border-blue-500 font-medium'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById(h.id);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          >
            {h.text.length > 30 ? h.text.slice(0, 28) + '...' : h.text}
          </a>
        ))}
      </nav>
    </div>
  );
}

// ========== 相关文章推荐组件 ==========
interface RelatedPost {
  id: string;
  title: string;
  category: { name: string; slug: string };
  viewCount: number;
  commentCount: number;
  likeCount: number;
  isEssence: boolean;
  createdAt: string;
  tagMatchCount: number;
}

function RelatedPosts({ postId }: { postId: string }) {
  const [posts, setPosts] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/forum/posts/${postId}/related?limit=5`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!mounted) return;
        if (data?.relatedPosts?.length > 0) {
          setPosts(data.relatedPosts);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [postId]);

  if (loading || posts.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
        <span>📚</span>
        <span>相关文章</span>
      </h3>
      <div className="space-y-2">
        {posts.map((p) => (
          <Link
            key={p.id}
            href={`/forum/post/${p.id}`}
            className="block p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-200 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                  {p.isEssence && <span className="text-violet-500 mr-1">⭐</span>}
                  {p.title}
                </h4>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                  <span>{p.category?.name || '讨论'}</span>
                  <span>👁 {p.viewCount}</span>
                  <span>💬 {p.commentCount}</span>
                </div>
              </div>
              {p.tagMatchCount > 0 && (
                <span className="shrink-0 text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                  {p.tagMatchCount} 个标签匹配
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
