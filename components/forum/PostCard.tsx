"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatTimeAgo, truncateText, stripMarkdown, cn } from "@/lib/utils";
import UserAvatar from "@/components/common/UserAvatar";
import { useAppStore } from "@/lib/store";
import toast from "react-hot-toast";

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
  authorId?: string;
}

interface PostCardProps {
  post: Post;
  showActions?: boolean;
}

// 分类 → 图标 & 颜色
const categoryMap: Record<
  string,
  { icon: string; label: string; colorClass: string }
> = {
  announcement: {
    icon: "📢",
    label: "公告",
    colorClass: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  feedback: {
    icon: "💬",
    label: "反馈",
    colorClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  tutorial: {
    icon: "📖",
    label: "教程",
    colorClass: "bg-green-50 text-green-700 border-green-200",
  },
  chat: {
    icon: "🗣️",
    label: "闲聊",
    colorClass: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

export default function PostCard({ post, showActions = false }: PostCardProps) {
  const router = useRouter();
  const { user, token } = useAppStore();
  const category = categoryMap[post.category] ?? {
    icon: "📋",
    label: post.category,
    colorClass: "bg-gray-50 text-gray-700 border-gray-200",
  };

  const canManage = showActions && user && (post.authorId === user.id || user.role === 'ADMIN');

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) {
      toast.error('请先登录');
      return;
    }
    if (!confirm('确定要删除这篇帖子吗？删除后无法恢复。')) {
      return;
    }
    try {
      const res = await fetch(`/api/forum/posts/${post.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('帖子已删除');
        router.refresh();
      } else {
        const errData = await res.json();
        toast.error(errData.error || '删除失败');
      }
    } catch {
      toast.error('删除帖子失败');
    }
  };

  return (
    <div
      className={cn(
        "group bg-white rounded-xl border p-4 sm:p-5 transition-all duration-200 hover:shadow-md hover:border-gray-300",
        post.isPinned && "border-l-4 border-l-red-400 bg-red-50/30"
      )}
    >
      {/* 顶部：用户信息 + 分类标签 */}
      <div className="flex items-start gap-3 mb-2.5">
        {/* 头像 */}
        <UserAvatar username={post.author.username} avatar={post.author.avatar} size="md" />

        <div className="flex-1 min-w-0">
          {/* 用户名 + 时间 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-700 truncate">
              {post.author.username}
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400">
              {formatTimeAgo(post.createdAt)}
            </span>
          </div>

          {/* 分类标签 + 置顶/精华 */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border",
                category.colorClass
              )}
            >
              <span className="mr-1">{category.icon}</span>
              {category.label}
            </span>

            {post.isPinned && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600 border border-red-200">
                📌 置顶
              </span>
            )}

            {post.isEssence && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                ⭐ 精华
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 标题 */}
      <h3 className="text-base sm:text-lg font-semibold mb-1.5 ml-12">
        <Link
          href={`/forum/post/${post.id}`}
          className="text-gray-900 hover:text-blue-600 transition-colors"
        >
          {post.title}
        </Link>
      </h3>

      {/* 正文预览 */}
      <p className="text-sm text-gray-500 mb-3 leading-relaxed ml-12 line-clamp-2">
        {truncateText(stripMarkdown(post.content), 120)}
      </p>

      {/* 底部统计行 */}
      <div className="flex items-center gap-4 ml-12 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {post.viewCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {post.likeCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {post.commentCount}
        </span>

        {/* 管理按钮（仅作者/管理员在 showActions 模式下显示） */}
        {canManage && (
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/forum/post/${post.id}/edit`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
            >
              ✏️ 编辑
            </Link>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
            >
              🗑️ 删除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
