"use client";

import Link from "next/link";
import { formatTimeAgo } from "@/lib/utils";
import type { MyPost } from "./types";

interface PostCardProps {
  post: MyPost;
  showActions?: boolean;
}

/**
 * 共享帖子卡片组件
 * 用于「我的帖子」「我的点赞」等列表中展示单条帖子摘要。
 */
export default function PostCard({ post, showActions = false }: PostCardProps) {
  return (
    <article className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-sm transition-shadow">
      {/* 顶部标签行：分类（蓝）/ 置顶（红）/ 精华（橙） */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {post.category && (
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            {post.category.name}
          </span>
        )}
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

      {/* 标题 - 蓝色文字，点击跳转帖子详情 */}
      <h3 className="text-[15px] sm:text-lg font-semibold mb-1.5">
        <Link
          href={`/forum/post/${post.id}`}
          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          {post.title}
        </Link>
      </h3>

      {/* 摘要 - 2 行截断 */}
      <p className="text-[11px] sm:text-sm text-gray-500 mb-3 line-clamp-2 leading-relaxed">
        {post.summary}
      </p>

      {/* 底部信息行：时间 · 浏览 · 点赞 · 评论 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center text-xs text-gray-400 space-x-3">
          <span>{formatTimeAgo(post.createdAt)}</span>
          <span>·</span>
          <span>👁 {post.viewCount}</span>
          <span>·</span>
          <span>❤️ {post.likeCount}</span>
          <span>·</span>
          <span>💬 {post.commentCount}</span>
        </div>

        {/* 可选操作按钮区域：编辑 / 查看 */}
        {showActions && (
          <div className="flex items-center gap-2">
            <Link
              href={`/forum/post/${post.id}/edit`}
              className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              编辑
            </Link>
            <Link
              href={`/forum/post/${post.id}`}
              className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
            >
              查看
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
