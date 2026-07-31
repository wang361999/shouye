"use client";

import Link from "next/link";
import { formatTimeAgo, truncateText, stripMarkdown, cn } from "@/lib/utils";

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

interface PostCardProps {
  post: Post;
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

// 头像占位组件
function Avatar({ username, avatar }: { username: string; avatar?: string | null }) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={username}
        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  // 取用户名第一个字符作为头像占位
  const initial = username.charAt(0).toUpperCase();
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500",
    "bg-orange-500", "bg-pink-500", "bg-indigo-500",
  ];
  const colorIndex = username.charCodeAt(0) % colors.length;
  return (
    <div className={cn(
      "w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0",
      colors[colorIndex]
    )}>
      {initial}
    </div>
  );
}

export default function PostCard({ post }: PostCardProps) {
  const category = categoryMap[post.category] ?? {
    icon: "📋",
    label: post.category,
    colorClass: "bg-gray-50 text-gray-700 border-gray-200",
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
        <Avatar username={post.author.username} avatar={post.author.avatar} />

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
      </div>
    </div>
  );
}
