"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import PostCard from "./PostCard";

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
  postType?: string;
  isAIGenerated?: boolean;
  tags?: { tag: { id: string; name: string; slug: string } }[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  postCount: number;
}

interface PostListProps {
  posts: Post[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onCategoryChange: (category: string) => void;
  currentCategory: string;
  categories: Category[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showActions?: boolean;
}

type SortType = "latest" | "hot" | "essence";

export default function PostList({
  posts,
  currentPage,
  totalPages,
  onPageChange,
  onCategoryChange,
  currentCategory,
  categories,
  searchQuery = "",
  onSearchChange,
  showActions = false,
}: PostListProps) {
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [sortBy, setSortBy] = useState<SortType>("latest");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange?.(searchInput);
  };

  // 排序帖子（置顶始终在最前）
  const getSortedPosts = (): Post[] => {
    const pinned = posts.filter((p) => p.isPinned);
    const rest = posts.filter((p) => !p.isPinned);

    const sortFn = (a: Post, b: Post): number => {
      switch (sortBy) {
        case "hot":
          return b.likeCount + b.viewCount - (a.likeCount + a.viewCount);
        case "essence":
          if (a.isEssence !== b.isEssence) return a.isEssence ? -1 : 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "latest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    };

    return [...pinned, ...rest.sort(sortFn)];
  };

  // 构造分页器页码
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const sortOptions: { value: SortType; label: string }[] = [
    { value: "latest", label: "最新" },
    { value: "hot", label: "最热" },
    { value: "essence", label: "精华" },
  ];

  const sortedPosts = getSortedPosts();

  return (
    <div className="space-y-4">
      {/* 工具栏：搜索 + 排序 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* 搜索框 */}
        <form onSubmit={handleSearch} className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索帖子..."
            className="w-full pl-9 pr-4 py-2 text-[16px] sm:text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
          />
        </form>

        {/* 排序 — 分段控件 */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={cn(
                "px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-all whitespace-nowrap",
                sortBy === opt.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 分类标签栏 */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <button
          onClick={() => onCategoryChange("all")}
          className={cn(
            "px-3 py-1.5 text-[11px] sm:text-sm font-medium rounded-full transition-all whitespace-nowrap shrink-0",
            currentCategory === "all"
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50",
          )}
        >
          全部
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.slug)}
            className={cn(
              "px-3 py-1.5 text-[11px] sm:text-sm font-medium rounded-full transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0",
              currentCategory === cat.slug
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50",
            )}
          >
            {cat.name}
            {cat.postCount > 0 && (
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[10px] rounded-full font-medium",
                  currentCategory === cat.slug
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500",
                )}
              >
                {cat.postCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 帖子列表 */}
      <div className="space-y-3">
        {sortedPosts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-50 rounded-full mb-3">
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-[13px] sm:text-sm text-gray-400">暂无帖子</p>
            <p className="text-[11px] sm:text-xs text-gray-300 mt-1">成为第一个发帖的人吧</p>
          </div>
        ) : (
          sortedPosts.map((post) => (
            <PostCard key={post.id} post={post} showActions={showActions} />
          ))
        )}
      </div>

      {/* 分页器 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-4 flex-wrap">
          {/* 上一页 */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className={cn(
              "flex items-center gap-1 px-3 py-2 text-[13px] sm:text-sm rounded-lg transition-colors",
              currentPage <= 1
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-100",
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            上一页
          </button>

          {/* 页码 */}
          {getPageNumbers().map((page, idx) =>
            typeof page === "string" ? (
              <span key={`ellipsis-${idx}`} className="px-2 py-2 text-[13px] sm:text-sm text-gray-300">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={cn(
                  "w-9 h-9 text-[13px] sm:text-sm rounded-lg transition-all font-medium",
                  page === currentPage
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100",
                )}
              >
                {page}
              </button>
            ),
          )}

          {/* 下一页 */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className={cn(
              "flex items-center gap-1 px-3 py-2 text-[13px] sm:text-sm rounded-lg transition-colors",
              currentPage >= totalPages
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-100",
            )}
          >
            下一页
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
