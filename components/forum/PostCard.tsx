"use client";

import Link from "next/link";
import { formatTimeAgo, truncateText, stripMarkdown, cn } from "@/lib/utils";

interface Post {
  id: string;
  title: string;
  content: string;
  author: {
    username: string;
  };
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

export default function PostCard({ post }: PostCardProps) {
  const category = categoryMap[post.category] ?? {
    icon: "📋",
    label: post.category,
    colorClass: "bg-gray-50 text-gray-700 border-gray-200",
  };

  return (
    <div
      className={cn(
        "group bg-white rounded-lg border p-4 sm:p-5 transition-all duration-200 hover:shadow-md hover:border-gray-300",
        post.isPinned && "border-l-4 border-l-red-400"
      )}
    >
      {/* 顶部行：分类标签 + 置顶/精华 */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {/* 分类 */}
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border",
            category.colorClass
          )}
        >
          <span className="mr-1">{category.icon}</span>
          {category.label}
        </span>

        {/* 置顶 */}
        {post.isPinned && (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600 border border-red-200">
            📌 置顶
          </span>
        )}

        {/* 精华 */}
        {post.isEssence && (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-orange-600 border border-orange-200">
            ⭐ 精华
          </span>
        )}
      </div>

      {/* 标题 */}
      <h3 className="text-base sm:text-lg font-semibold mb-1.5">
        <Link
          href={`/forum/post/${post.id}`}
          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          {post.title}
        </Link>
      </h3>

      {/* 正文预览 */}
      <p className="text-sm text-gray-500 mb-3 leading-relaxed">
        {truncateText(stripMarkdown(post.content), 100)}
      </p>

      {/* 底部统计行 */}
      <div className="flex flex-wrap items-center text-xs text-gray-400 space-x-3">
        <span className="text-gray-600 font-medium">
          {post.author.username}
        </span>
        <span>·</span>
        <span>{formatTimeAgo(post.createdAt)}</span>
        <span>·</span>
        <span>👁 {post.viewCount}</span>
        <span>·</span>
        <span>❤️ {post.likeCount}</span>
        <span>·</span>
        <span>💬 {post.commentCount}</span>
      </div>
    </div>
  );
}
