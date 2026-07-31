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
}

type SortType = 'latest' | 'hot' | 'essence';

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
}: PostListProps) {
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [sortBy, setSortBy] = useState<SortType>('latest');

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
        case 'hot':
          return (b.likeCount + b.viewCount) - (a.likeCount + a.viewCount);
        case 'essence':
          // 精华帖优先
          if (a.isEssence !== b.isEssence) return a.isEssence ? -1 : 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'latest':
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

  const sortOptions: { value: SortType; label: string; icon: string }[] = [
    { value: 'latest', label: '最新', icon: '🕐' },
    { value: 'hot', label: '最热', icon: '🔥' },
    { value: 'essence', label: '精华', icon: '⭐' },
  ];

  const sortedPosts = getSortedPosts();

  return (
    <div className="space-y-4">
      {/* 分类标签栏 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onCategoryChange("all")}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-full border transition-colors",
            currentCategory === "all"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          )}
        >
          全部
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.slug)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-full border transition-colors inline-flex items-center gap-1",
              currentCategory === cat.slug
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            {cat.icon && <span>{cat.icon}</span>}
            {cat.name}
            {cat.postCount > 0 && (
              <span
                className={cn(
                  "ml-1 px-1.5 py-0.5 text-xs rounded-full",
                  currentCategory === cat.slug
                    ? "bg-blue-500/30 text-blue-100"
                    : "bg-gray-100 text-gray-500"
                )}
              >
                {cat.postCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 搜索框 + 排序选项 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索帖子..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </form>

        {/* 排序按钮组 */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                sortBy === opt.value
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              )}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 帖子列表 */}
      <div className="space-y-3">
        {sortedPosts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">暂无帖子</p>
          </div>
        ) : (
          sortedPosts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>

      {/* 分页器 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-1 pt-4">
          {/* 上一页 */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md border transition-colors",
              currentPage <= 1
                ? "text-gray-300 border-gray-200 cursor-not-allowed"
                : "text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            上一页
          </button>

          {/* 页码 */}
          {getPageNumbers().map((page, idx) =>
            typeof page === "string" ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 py-1.5 text-sm text-gray-400"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={cn(
                  "w-8 h-8 text-sm rounded-md border transition-colors",
                  page === currentPage
                    ? "bg-blue-600 text-white border-blue-600"
                    : "text-gray-600 border-gray-300 hover:bg-gray-50"
                )}
              >
                {page}
              </button>
            )
          )}

          {/* 下一页 */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md border transition-colors",
              currentPage >= totalPages
                ? "text-gray-300 border-gray-200 cursor-not-allowed"
                : "text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
