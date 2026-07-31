"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import PostCard from "./PostCard";

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

interface Category {
  id: string;
  name: string;
  icon: string;
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange?.(searchInput);
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
            onClick={() => onCategoryChange(cat.id)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-full border transition-colors",
              currentCategory === cat.id
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            )}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* 搜索框 */}
      <form onSubmit={handleSearch} className="relative">
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

      {/* 帖子列表 */}
      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg mb-2">📭</p>
            <p>暂无帖子</p>
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
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
